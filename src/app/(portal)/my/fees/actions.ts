"use server";

import { randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { paidSql } from "@/app/(app)/fees/queries";
import { instalmentDue, validatePayment } from "@/domain/fees";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { ALUMNI_READ_ONLY, requirePortal } from "@/server/portal";
import { batch, feeInstalment, feePayment, programme, student } from "@/server/schema";

const schema = z.object({ instalmentId: z.number().int().positive() });

/** Test-mode payment of the full remaining due on one instalment. The student comes from the session, never the client. */
export async function payTestMode(instalmentId: number): Promise<{ error: string } | { paymentId: number }> {
  const v = await requirePortal();
  if (v.alumni) return { error: ALUMNI_READ_ONLY };
  const parsed = schema.safeParse({ instalmentId });
  if (!parsed.success) return { error: "Pick an instalment to pay." };
  const reference = `TEST-${Array.from({ length: 8 }, () => String.fromCharCode(65 + randomInt(26))).join("")}`;

  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select({
      studentId: feeInstalment.studentId, id: feeInstalment.id, dueDate: feeInstalment.dueDate,
      amountPaise: feeInstalment.amountPaise, scholarshipPaise: feeInstalment.scholarshipPaise, paidPaise: paidSql,
    }).from(feeInstalment)
      .innerJoin(student, eq(feeInstalment.studentId, student.id))
      .innerJoin(batch, eq(student.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(and(eq(feeInstalment.id, parsed.data.instalmentId), eq(feeInstalment.studentId, v.studentId)))
      .for("update", { of: feeInstalment });
    if (!row) return { error: "This instalment isn't on your account." } as const;
    const paise = instalmentDue(row);
    if (paise === 0) return { error: "Nothing is due on this instalment." } as const;
    const err = validatePayment(row, paise);
    if (err) return { error: err } as const;

    const [p] = await tx.insert(feePayment).values({ instalmentId: row.id, amountPaise: paise, mode: "mock_link", reference })
      .returning({ id: feePayment.id });
    await audit(tx, v, {
      action: "fees.payment", entity: "student", entityId: v.studentId,
      oldValue: { instalmentId: row.id, duePaise: paise }, newValue: { instalmentId: row.id, duePaise: 0, amountPaise: paise, reference },
    });
    return { paymentId: p.id };
  });
  if ("paymentId" in result) {
    revalidatePath("/my/fees");
    revalidatePath("/my");
  }
  return result;
}
