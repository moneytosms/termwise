"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { istDate } from "@/domain/attendance";
import { dues, instalmentDue, validatePayment } from "@/domain/fees";
import { awardAmount, eligibilityError, semesterInstalments, spread, totalDue, unspread } from "@/domain/scholarship";
import { assertStudentAccess, requireCan, studentScope } from "@/server/access";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { batch, feeInstalment, feePayment, guardian, guardianStudent, message, programme, scholarshipAward, scholarshipScheme, student } from "@/server/schema";
import { paidSql } from "./queries";
import { isMinor } from "./reminder";
import { feeMessage, guardianLanguages } from "@/domain/templates";
import { rupees } from "@/lib/utils";

const remindSchema = z.object({ ids: z.array(z.number().int().positive()).min(1, "Select at least one student.") });

/** Logs a fee reminder per student with dues. Under 18 without parent consent is logged as blocked. */
export async function sendFeeReminders(ids: number[]): Promise<{ error?: string; logged?: number; blocked?: number; skipped?: number }> {
  const v = await requireCan("fees");
  const parsed = remindSchema.safeParse({ ids });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const counts = await db.transaction(async (tx) => {
    const people = await tx.select({ id: student.id, name: student.name, birthDate: student.birthDate, parentConsentAt: student.parentConsentAt })
      .from(student)
      .innerJoin(batch, eq(student.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(and(studentScope(v), inArray(student.id, parsed.data.ids)));
    const instalments = await tx.select({
      studentId: feeInstalment.studentId, id: feeInstalment.id, dueDate: feeInstalment.dueDate,
      amountPaise: feeInstalment.amountPaise, scholarshipPaise: feeInstalment.scholarshipPaise, paidPaise: paidSql,
    }).from(feeInstalment).where(inArray(feeInstalment.studentId, people.map((p) => p.id)));
    const guardians = await tx.select({ studentId: guardianStudent.studentId, language: guardian.language }).from(guardianStudent)
      .innerJoin(guardian, eq(guardianStudent.guardianId, guardian.id)).where(inArray(guardianStudent.studentId, people.map((p) => p.id)));

    const today = istDate();
    const n = { logged: 0, blocked: 0, skipped: 0 };
    for (const p of people) {
      const due = dues(instalments.filter((i) => i.studentId === p.id), today).totalPaise;
      if (!due) { n.skipped++; continue; }
      const status = isMinor(p.birthDate, today) && !p.parentConsentAt ? "blocked_no_consent" as const : "logged" as const;
      const link = `\n${process.env.BETTER_AUTH_URL ?? ""}/sign-in`;
      // One row per guardian language, like the daily job, so a parent reading in Odia sees it in Odia.
      const langs = guardianLanguages(guardians.filter((g) => g.studentId === p.id).map((g) => g.language));
      await tx.insert(message).values(langs.map((language) => ({
        studentId: p.id, kind: "fee_reminder" as const, language, body: feeMessage(language, p.name, rupees(due)) + link, status,
      })));
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
  const v = await requireCan("fees");
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

const awardSchema = z.object({
  studentId: z.number().int().positive(),
  schemeId: z.number().int().positive(),
  semester: z.number().int().min(1, "Enter a semester from 1 to 12.").max(12, "Enter a semester from 1 to 12."),
});

/** Awards a scheme for one semester. The amount is spread over that semester's instalments, earliest due first. */
export async function awardScholarship(input: { studentId: number; schemeId: number; semester: number }): Promise<{ error?: string }> {
  const v = await requireCan("fees");
  const parsed = awardSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { studentId, schemeId, semester } = parsed.data;
  await assertStudentAccess(v, studentId);

  const error = await db.transaction(async (tx) => {
    const [s] = await tx.select({ id: student.id, category: student.category, batchSemester: batch.semester }).from(student)
      .innerJoin(batch, eq(student.batchId, batch.id))
      .where(eq(student.id, studentId))
      .for("update", { of: student });
    if (!s) return "This student isn't available to you.";
    const [scheme] = await tx.select().from(scholarshipScheme)
      .where(and(eq(scholarshipScheme.id, schemeId), eq(scholarshipScheme.campusId, v.campusId)));
    if (!scheme) return "Pick a scheme from this campus.";
    const refused = eligibilityError(scheme, s.category);
    if (refused) return refused;
    const [existing] = await tx.select({ id: scholarshipAward.id }).from(scholarshipAward)
      .where(and(eq(scholarshipAward.studentId, studentId), eq(scholarshipAward.schemeId, schemeId),
        eq(scholarshipAward.semester, semester), isNull(scholarshipAward.withdrawnAt)));
    if (existing) return "This scheme is already awarded for that semester.";

    const instalments = await tx.select({
      id: feeInstalment.id, dueDate: feeInstalment.dueDate, amountPaise: feeInstalment.amountPaise,
      scholarshipPaise: feeInstalment.scholarshipPaise, semester: feeInstalment.semester, paidPaise: paidSql,
    }).from(feeInstalment).where(eq(feeInstalment.studentId, studentId));
    const semesterList = semesterInstalments(instalments, semester, s.batchSemester);
    const total = semesterList.reduce((sum, i) => sum + i.amountPaise, 0);
    const amount = awardAmount(scheme, total);
    if (total === 0 || amount <= 0) return "There are no fees for that semester to award against.";
    const increments = spread(semesterList, amount);
    if (increments.reduce((sum, i) => sum + i.addPaise, 0) < amount) return "Scholarships already cover this semester's fees.";
    for (const inc of increments) {
      await tx.update(feeInstalment).set({ scholarshipPaise: sql`${feeInstalment.scholarshipPaise} + ${inc.addPaise}` })
        .where(eq(feeInstalment.id, inc.id));
    }
    const [award] = await tx.insert(scholarshipAward).values({ studentId, schemeId, semester, amountPaise: amount }).returning();
    await audit(tx, v, {
      action: "fees.scholarship.award", entity: "student", entityId: studentId,
      newValue: { awardId: award.id, scheme: scheme.name, semester, amountPaise: amount },
    });
    return null;
  });
  if (error) return { error };
  revalidatePath("/fees");
  return {};
}

/** Withdraws an award and takes it back off the semester's instalments, unless the semester is already paid down. */
export async function withdrawScholarship(input: { awardId: number }): Promise<{ error?: string }> {
  const v = await requireCan("fees");
  const parsed = z.object({ awardId: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const [head] = await db.select({ studentId: scholarshipAward.studentId }).from(scholarshipAward)
    .where(eq(scholarshipAward.id, parsed.data.awardId));
  if (!head) return { error: "This award isn't available to you." };
  await assertStudentAccess(v, head.studentId);

  const error = await db.transaction(async (tx) => {
    const [s] = await tx.select({ id: student.id, batchSemester: batch.semester }).from(student)
      .innerJoin(batch, eq(student.batchId, batch.id))
      .where(eq(student.id, head.studentId))
      .for("update", { of: student });
    if (!s) return "This award isn't available to you.";
    const [award] = await tx.select({ id: scholarshipAward.id, schemeId: scholarshipAward.schemeId, semester: scholarshipAward.semester,
      amountPaise: scholarshipAward.amountPaise, withdrawnAt: scholarshipAward.withdrawnAt, scheme: scholarshipScheme.name })
      .from(scholarshipAward).innerJoin(scholarshipScheme, eq(scholarshipAward.schemeId, scholarshipScheme.id))
      .where(eq(scholarshipAward.id, parsed.data.awardId));
    if (!award || award.withdrawnAt) return "This award is already withdrawn.";

    const instalments = await tx.select({
      id: feeInstalment.id, dueDate: feeInstalment.dueDate, amountPaise: feeInstalment.amountPaise,
      scholarshipPaise: feeInstalment.scholarshipPaise, semester: feeInstalment.semester, paidPaise: paidSql,
    }).from(feeInstalment).where(eq(feeInstalment.studentId, s.id));
    const semesterList = semesterInstalments(instalments, award.semester, s.batchSemester);
    if (totalDue(semesterList) === 0) return "Already paid; the award can't be withdrawn.";
    for (const dec of unspread(semesterList, award.amountPaise)) {
      await tx.update(feeInstalment).set({ scholarshipPaise: sql`${feeInstalment.scholarshipPaise} - ${dec.subPaise}` })
        .where(eq(feeInstalment.id, dec.id));
    }
    await tx.update(scholarshipAward).set({ withdrawnAt: new Date() }).where(eq(scholarshipAward.id, award.id));
    await audit(tx, v, {
      action: "fees.scholarship.withdraw", entity: "student", entityId: s.id,
      oldValue: { awardId: award.id, scheme: award.scheme, semester: award.semester, amountPaise: award.amountPaise },
    });
    return null;
  });
  if (error) return { error };
  revalidatePath("/fees");
  return {};
}
