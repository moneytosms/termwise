"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { istDate } from "@/domain/attendance";
import { dues, instalmentDue, validatePayment } from "@/domain/fees";
import { requireAdmin, studentScope } from "@/server/access";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { batch, feeInstalment, feePayment, message, programme, student } from "@/server/schema";
import { paidSql } from "./queries";
import { isMinor, reminderBody } from "./reminder";
import { feeMessage } from "@/domain/templates";
import { rupees } from "@/lib/utils";

const remindSchema = z.object({ ids: z.array(z.number().int().positive()).min(1, "Select at least one student.") });

/** Logs a fee reminder per student with dues. Under 18 without parent consent is logged as blocked. */
export async function sendFeeReminders(ids: number[]): Promise<{ error?: string; logged?: number; blocked?: number; skipped?: number }> {
  const v = await requireAdmin();
  const parsed = remindSchema.safeParse({ ids });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const counts = await db.transaction(async (tx) => {
    const people = await tx.select({ id: student.id, name: student.name, rollNo: student.rollNo, birthDate: student.birthDate, parentConsentAt: student.parentConsentAt })
      .from(student)
      .innerJoin(batch, eq(student.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(and(studentScope(v), inArray(student.id, parsed.data.ids)));
    const instalments = await tx.select({
      studentId: feeInstalment.studentId, id: feeInstalment.id, dueDate: feeInstalment.dueDate,
      amountPaise: feeInstalment.amountPaise, scholarshipPaise: feeInstalment.scholarshipPaise, paidPaise: paidSql,
    }).from(feeInstalment).where(inArray(feeInstalment.studentId, people.map((p) => p.id)));

    const today = istDate();
    const n = { logged: 0, blocked: 0, skipped: 0 };
    for (const p of people) {
      const due = dues(instalments.filter((i) => i.studentId === p.id), today).totalPaise;
      if (!due) { n.skipped++; continue; }
      const status = isMinor(p.birthDate, today) && !p.parentConsentAt ? "blocked_no_consent" : "logged";
      const link = `\n${process.env.BETTER_AUTH_URL ?? ""}/sign-in`;
      // Both languages, like the daily job, so a parent reading in Odia sees it too.
      await tx.insert(message).values([
        { studentId: p.id, kind: "fee_reminder", language: "en", body: reminderBody(p.name, p.rollNo, due) + link, status },
        { studentId: p.id, kind: "fee_reminder", language: "or", body: feeMessage("or", p.name, rupees(due)) + link, status },
      ]);
      await audit(tx, v, { action: "fees.reminder", entity: "student", entityId: p.id, newValue: { status, duePaise: due } });
      if (status === "logged") n.logged++; else n.blocked++;
    }
    return n;
  });
  revalidatePath("/fees");
  return counts;
}

const paymentSchema = z.object({
  instalmentId: z.number().int().positive(),
  rupees: z.number().finite(),
  reference: z.string().trim().min(1, "Enter the bank reference.").max(40, "Reference must be 40 characters or fewer."),
});

/** Records a bank counter payment against one instalment. Validated on the locked, freshly-read instalment. */
export async function recordPayment(input: { instalmentId: number; rupees: number; reference: string }): Promise<{ error?: string }> {
  const v = await requireAdmin();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { instalmentId, reference } = parsed.data;
  const paise = Math.round(parsed.data.rupees * 100);

  const error = await db.transaction(async (tx) => {
    const [row] = await tx.select({
      studentId: feeInstalment.studentId, id: feeInstalment.id, dueDate: feeInstalment.dueDate,
      amountPaise: feeInstalment.amountPaise, scholarshipPaise: feeInstalment.scholarshipPaise, paidPaise: paidSql,
    }).from(feeInstalment)
      .innerJoin(student, eq(feeInstalment.studentId, student.id))
      .innerJoin(batch, eq(student.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(and(eq(feeInstalment.id, instalmentId), studentScope(v)))
      .for("update", { of: feeInstalment });
    if (!row) return "This instalment isn't available to you.";
    const err = validatePayment(row, paise);
    if (err) return err;

    const before = instalmentDue(row);
    await tx.insert(feePayment).values({ instalmentId, amountPaise: paise, mode: "bank_counter", reference });
    await audit(tx, v, {
      action: "fees.payment", entity: "student", entityId: row.studentId,
      oldValue: { instalmentId, duePaise: before }, newValue: { instalmentId, duePaise: before - paise, amountPaise: paise, reference },
    });
    return null;
  });
  if (error) return { error };
  revalidatePath("/fees");
  return {};
}
