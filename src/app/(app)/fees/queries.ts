import { and, desc, eq, gte, sql } from "drizzle-orm";
import { istDate } from "@/domain/attendance";
import { dues, instalmentDue } from "@/domain/fees";
import { assertStudentAccess, studentScope, type Viewer } from "@/server/access";
import { db } from "@/server/db";
import { batch, feeInstalment, feePayment, programme, student } from "@/server/schema";

/** Paid so far on the instalment of the enclosing query (`fee_instalment`). */
export const paidSql = sql<number>`(select coalesce(sum(p.amount_paise),0) from ${feePayment} p where p.instalment_id=fee_instalment.id)`.mapWith(Number);

export type FeeStatus = "Clear" | "Due" | "Overdue";
export type FeeRow = { id: number; rollNo: string; name: string; batch: string; duePaise: number; overduePaise: number; nextDue: string | null; status: FeeStatus };

/** One row per student on this campus. Dues are calculated, never stored. */
export async function listFeeDues(v: Viewer): Promise<FeeRow[]> {
  const students = await db.select({ id: student.id, rollNo: student.rollNo, name: student.name, batch: batch.code })
    .from(student)
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(studentScope(v))
    .orderBy(student.rollNo);
  const instalments = await db.select({
    studentId: feeInstalment.studentId, id: feeInstalment.id, dueDate: feeInstalment.dueDate,
    amountPaise: feeInstalment.amountPaise, scholarshipPaise: feeInstalment.scholarshipPaise, paidPaise: paidSql,
  }).from(feeInstalment)
    .innerJoin(student, eq(feeInstalment.studentId, student.id))
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(studentScope(v));

  const today = istDate();
  return students.map((s): FeeRow => {
    const list = instalments.filter((i) => i.studentId === s.id);
    const { totalPaise, overduePaise } = dues(list, today);
    const nextDue = list.filter((i) => instalmentDue(i) > 0).map((i) => i.dueDate).sort()[0] ?? null;
    return { ...s, duePaise: totalPaise, overduePaise, nextDue, status: overduePaise ? "Overdue" : totalPaise ? "Due" : "Clear" };
  });
}

/** Paise collected on this campus since the start of the current IST month. */
export async function collectedThisMonth(v: Viewer): Promise<number> {
  const monthStart = new Date(`${istDate().slice(0, 7)}-01T00:00:00+05:30`);
  const [row] = await db.select({ paise: sql<number>`coalesce(sum(${feePayment.amountPaise}),0)`.mapWith(Number) })
    .from(feePayment)
    .innerJoin(feeInstalment, eq(feePayment.instalmentId, feeInstalment.id))
    .innerJoin(student, eq(feeInstalment.studentId, student.id))
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(studentScope(v), gte(feePayment.paidAt, monthStart)));
  return row.paise;
}

/** Side panel data. Throws if the viewer may not see this student. */
export async function getFeeDetail(v: Viewer, id: number) {
  await assertStudentAccess(v, id);
  const [s] = await db.select({ id: student.id, rollNo: student.rollNo, name: student.name, batch: batch.code })
    .from(student).innerJoin(batch, eq(student.batchId, batch.id)).where(eq(student.id, id));
  const instalments = await db.select({
    id: feeInstalment.id, label: feeInstalment.label, dueDate: feeInstalment.dueDate,
    amountPaise: feeInstalment.amountPaise, scholarshipPaise: feeInstalment.scholarshipPaise, paidPaise: paidSql,
  }).from(feeInstalment).where(eq(feeInstalment.studentId, id)).orderBy(feeInstalment.dueDate);
  const payments = await db.select({
    id: feePayment.id, label: feeInstalment.label, amountPaise: feePayment.amountPaise, mode: feePayment.mode,
    reference: feePayment.reference, paidAt: feePayment.paidAt,
  }).from(feePayment)
    .innerJoin(feeInstalment, eq(feePayment.instalmentId, feeInstalment.id))
    .where(eq(feeInstalment.studentId, id))
    .orderBy(desc(feePayment.paidAt));
  return { student: s, instalments, payments };
}
export type FeeDetail = Awaited<ReturnType<typeof getFeeDetail>>;
