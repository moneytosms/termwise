import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { correctedEditedAt, decideSync, type OutboxItem } from "@/domain/sync";
import { getViewer, type Viewer } from "@/server/access";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { attendanceEntry, attendanceSession, batch, programme, student, subject, syncConflict } from "@/server/schema";

const Item = z.object({
  sessionId: z.uuid(),
  batchId: z.number().int(),
  subjectId: z.number().int(),
  date: z.iso.date(),
  period: z.number().int().min(1).max(9),
  periodCount: z.number().int().min(1).max(9),
  entries: z.array(z.object({ studentId: z.number().int(), status: z.enum(["present", "absent", "late"]) })).min(1).max(500),
  editedAt: z.iso.datetime(),
  markedBy: z.number().int(),
});
const Body = z.object({ clientNow: z.iso.datetime(), items: z.array(Item).max(100) });

async function apply(v: Viewer, item: OutboxItem, editedAt: Date) {
  // A shared phone can hold a sheet from a teacher whose sign-in expired; only they can send it.
  if (item.markedBy !== v.staffId) return { outcome: "rejected" as const, error: "Marked by another teacher on this phone. They need to sign in to send it." };
  // The subject must belong to this batch and campus, and the sheet must cover exactly its students.
  const [valid] = await db.select({ id: subject.id }).from(subject)
    .innerJoin(batch, eq(subject.batchId, batch.id)).innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(subject.id, item.subjectId), eq(subject.batchId, item.batchId), eq(programme.campusId, v.campusId)));
  if (!valid) return { outcome: "rejected" as const, error: "This class isn't on your campus." };
  const roster = await db.select({ id: student.id }).from(student).where(eq(student.batchId, item.batchId));
  const ids = new Set(roster.map((r) => r.id));
  if (new Set(item.entries.map((e) => e.studentId)).size !== item.entries.length || item.entries.length !== ids.size || item.entries.some((e) => !ids.has(e.studentId))) {
    return { outcome: "rejected" as const, error: "The class list changed. Refresh and mark again." };
  }

  return db.transaction(async (tx) => {
    // Serialise concurrent submissions for the same class.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${item.batchId}:${item.subjectId}:${item.date}:${item.period}`}))`);
    const [existing] = await tx.select().from(attendanceSession).where(and(
      eq(attendanceSession.batchId, item.batchId), eq(attendanceSession.subjectId, item.subjectId),
      eq(attendanceSession.date, item.date), eq(attendanceSession.period, item.period),
    ));
    const d = decideSync(existing ?? null, { facultyId: v.staffId, date: item.date, editedAt });

    if (d.action === "ignore") return { outcome: "stale" as const, sessionId: existing.id };
    if (d.action === "conflict") {
      await tx.insert(syncConflict).values({ sessionId: existing?.id ?? null, kind: d.kind, facultyId: v.staffId, payload: item });
      await audit(tx, v, { action: "attendance.conflict", entity: "attendance_session", entityId: existing?.id ?? item.sessionId, newValue: { kind: d.kind, entries: item.entries } });
      return { outcome: "conflict" as const, sessionId: existing?.id ?? null };
    }
    if (d.action === "insert") {
      await tx.insert(attendanceSession).values({ id: item.sessionId, batchId: item.batchId, subjectId: item.subjectId, date: item.date, period: item.period, periodCount: item.periodCount, facultyId: v.staffId, editedAt });
      await tx.insert(attendanceEntry).values(item.entries.map((e) => ({ ...e, sessionId: item.sessionId })));
      await audit(tx, v, { action: "attendance.create", entity: "attendance_session", entityId: item.sessionId, newValue: item.entries });
      return { outcome: "saved" as const, sessionId: item.sessionId };
    }
    const old = await tx.select({ studentId: attendanceEntry.studentId, status: attendanceEntry.status }).from(attendanceEntry).where(eq(attendanceEntry.sessionId, existing.id));
    await tx.delete(attendanceEntry).where(eq(attendanceEntry.sessionId, existing.id));
    await tx.insert(attendanceEntry).values(item.entries.map((e) => ({ ...e, sessionId: existing.id })));
    await tx.update(attendanceSession).set({ editedAt, syncedAt: new Date() }).where(eq(attendanceSession.id, existing.id));
    await audit(tx, v, { action: "attendance.update", entity: "attendance_session", entityId: existing.id, oldValue: old, newValue: item.entries });
    return { outcome: "saved" as const, sessionId: existing.id };
  });
}

/** Accepts a batch of outbox items. Each gets its own result, so one bad item can't block the rest. */
export async function POST(req: Request) {
  const v = await getViewer();
  if (!v) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const now = new Date();
  const results = [];
  for (const item of parsed.data.items) {
    results.push({ sessionId: item.sessionId, ...(await apply(v, item, correctedEditedAt(item.editedAt, parsed.data.clientNow, now))) });
  }
  return NextResponse.json({ results });
}
