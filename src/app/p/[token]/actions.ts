"use server";

import { randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { paidSql } from "@/app/(app)/fees/queries";
import { instalmentDue, validatePayment } from "@/domain/fees";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { readParentToken } from "@/server/parent-link";
import { batch, feeInstalment, feePayment, programme, student } from "@/server/schema";

const schema = z.object({ token: z.string().max(300), instalmentId: z.number().int().positive() });

/** Test-mode payment of the full remaining due on one instalment. The student comes from the token, never the client. */
export async function payTestMode(token: string, instalmentId: number): Promise<{ error: string } | { paymentId: number }> {
  const parsed = schema.safeParse({ token, instalmentId });
  if (!parsed.success) return { error: "This link isn't valid." };
  const studentId = readParentToken(parsed.data.token);
  if (!studentId) return { error: "This link has expired or isn't valid." };
  const reference = `TEST-${Array.from({ length: 8 }, () => String.fromCharCode(65 + randomInt(26))).join("")}`;

  return db.transaction(async (tx) => {
    const [row] = await tx.select({
      studentId: feeInstalment.studentId, id: feeInstalment.id, dueDate: feeInstalment.dueDate,
      amountPaise: feeInstalment.amountPaise, scholarshipPaise: feeInstalment.scholarshipPaise, paidPaise: paidSql,
      campusId: programme.campusId,
    }).from(feeInstalment)
      .innerJoin(student, eq(feeInstalment.studentId, student.id))
      .innerJoin(batch, eq(student.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(and(eq(feeInstalment.id, instalmentId), eq(feeInstalment.studentId, studentId)))
      .for("update", { of: feeInstalment });
    if (!row) return { error: "This instalment isn't on this link." };
    const paise = instalmentDue(row);
    if (paise === 0) return { error: "Nothing is due on this instalment." };
    const err = validatePayment(row, paise);
    if (err) return { error: err };

    const [p] = await tx.insert(feePayment).values({ instalmentId, amountPaise: paise, mode: "mock_link", reference })
      .returning({ id: feePayment.id });
    await audit(tx, { userId: null, name: "Parent link", campusId: row.campusId }, {
      action: "fees.payment", entity: "student", entityId: studentId,
      oldValue: { instalmentId, duePaise: paise }, newValue: { instalmentId, duePaise: 0, amountPaise: paise, reference },
    });
    return { paymentId: p.id };
  });
}
