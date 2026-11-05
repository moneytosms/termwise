import { SOURCE, TASK } from "./labels";
import { and, desc, eq, isNull } from "drizzle-orm";
import { istDate } from "@/domain/attendance";
import { studentScope, type Viewer } from "@/server/access";
import { db } from "@/server/db";
import { batch, jobRun, mentorTask, programme, riskFlag, staff, student } from "@/server/schema";

export type RiskRow = {
  id: number; studentId: number; rollNo: string; name: string; batch: string; reason: string;
  source: string; mentor: string; task: string; flaggedOn: string;
};


/** Active flags on this campus, newest first. Tasks are null-joined: a flag may have no mentor task yet. */
export async function listRisk(v: Viewer): Promise<RiskRow[]> {
  const rows = await db.select({
    id: riskFlag.id, studentId: student.id, rollNo: student.rollNo, name: student.name, batch: batch.code,
    reason: riskFlag.reasonText, source: riskFlag.reasonSource, createdAt: riskFlag.createdAt,
    mentor: staff.name, task: mentorTask.status,
  }).from(riskFlag)
    .innerJoin(student, eq(riskFlag.studentId, student.id))
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .leftJoin(mentorTask, eq(mentorTask.flagId, riskFlag.id))
    .leftJoin(staff, eq(mentorTask.mentorId, staff.id))
    .where(and(eq(riskFlag.active, true), studentScope(v), isNull(student.graduatedOn)))
    .orderBy(desc(riskFlag.createdAt), desc(riskFlag.id));

  return rows.map((r) => ({
    id: r.id, studentId: r.studentId, rollNo: r.rollNo, name: r.name, batch: r.batch, reason: r.reason,
    source: SOURCE[r.source], mentor: r.mentor ?? "–", task: r.task ? TASK[r.task] : "–",
    flaggedOn: istDate(r.createdAt),
  }));
}

export async function lastRun(v: Viewer): Promise<Date | null> {
  const [row] = await db.select({ at: jobRun.startedAt }).from(jobRun)
    .where(eq(jobRun.campusId, v.campusId)).orderBy(desc(jobRun.startedAt)).limit(1);
  return row?.at ?? null;
}
