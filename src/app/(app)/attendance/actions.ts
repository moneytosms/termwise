"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { OutboxItem } from "@/domain/sync";
import { requireAdmin } from "@/server/access";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { attendanceEntry, attendanceSession, batch, programme, syncConflict } from "@/server/schema";

const Status = z.enum(["present", "absent", "late"]);

/** Admin correction of a saved session. Writes and audits only the students whose status changed. */
export async function correctSession(
  sessionId: string, entries: { studentId: number; status: "present" | "absent" | "late" }[], reason: string,
): Promise<{ error?: string }> {
  const v = await requireAdmin();
  const input = z.object({
    sessionId: z.uuid(),
    entries: z.array(z.object({ studentId: z.number().int(), status: Status })).min(1),
    reason: z.string().trim().min(1, "Give a reason for the correction."),
  }).safeParse({ sessionId, entries, reason });
  if (!input.success) return { error: input.error.issues[0].message };
  const { entries: next, reason: why } = input.data;

  const result = await db.transaction(async (tx): Promise<{ error?: string }> => {
    const [s] = await tx.select({ id: attendanceSession.id }).from(attendanceSession)
      .innerJoin(batch, eq(attendanceSession.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(and(eq(attendanceSession.id, input.data.sessionId), eq(programme.campusId, v.campusId)));
    if (!s) return { error: "Session not found." };

    const saved = await tx.select({ studentId: attendanceEntry.studentId, status: attendanceEntry.status })
      .from(attendanceEntry).where(eq(attendanceEntry.sessionId, s.id));
    const before = new Map(saved.map((e) => [e.studentId, e.status]));
    const ids = new Set(next.map((e) => e.studentId));
    if (ids.size !== next.length || ids.size !== before.size || next.some((e) => !before.has(e.studentId))) {
      return { error: "The students don't match this session. Refresh and try again." };
    }
    const changed = next.filter((e) => before.get(e.studentId) !== e.status);
    if (changed.length === 0) return { error: "No status was changed." };

    for (const e of changed) {
      await tx.update(attendanceEntry).set({ status: e.status })
        .where(and(eq(attendanceEntry.sessionId, s.id), eq(attendanceEntry.studentId, e.studentId)));
    }
    await tx.update(attendanceSession).set({ editedAt: new Date() }).where(eq(attendanceSession.id, s.id));
    await audit(tx, v, {
      action: "attendance.correct", entity: "attendance_session", entityId: s.id,
      oldValue: Object.fromEntries(changed.map((e) => [e.studentId, before.get(e.studentId)])),
      newValue: Object.fromEntries(changed.map((e) => [e.studentId, e.status])),
      reason: why,
    });
    return {};
  });
  revalidatePath("/attendance");
  revalidatePath("/students");
  return result;
}

/** "keep" leaves the saved session as it is; "replace" writes the incoming entries over it (or creates it). */
export async function resolveConflict(conflictId: string, choice: "keep" | "replace"): Promise<{ error?: string }> {
  const v = await requireAdmin();
  const input = z.object({ conflictId: z.uuid(), choice: z.enum(["keep", "replace"]) }).safeParse({ conflictId, choice });
  if (!input.success) return { error: "Invalid choice." };

  const result = await db.transaction(async (tx): Promise<{ error?: string }> => {
    const [found] = await tx.select({ c: syncConflict }).from(syncConflict)
      .innerJoin(batch, sql`${batch.id} = (${syncConflict.payload}->>'batchId')::int`)
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(and(eq(syncConflict.id, input.data.conflictId), eq(programme.campusId, v.campusId)));
    if (!found) return { error: "Conflict not found." };
    const c = found.c;
    if (c.status !== "open") return { error: "This conflict is already resolved." };

    const p = c.payload as OutboxItem;
    const saved = c.sessionId
      ? await tx.select({ studentId: attendanceEntry.studentId, status: attendanceEntry.status })
        .from(attendanceEntry).where(eq(attendanceEntry.sessionId, c.sessionId))
      : [];
    const entityId = c.sessionId ?? p.sessionId;
    const resolved = { resolvedBy: v.userId, resolvedAt: new Date() };

    if (input.data.choice === "keep") {
      await tx.update(syncConflict).set({ status: "kept", ...resolved }).where(eq(syncConflict.id, c.id));
      await audit(tx, v, {
        action: "attendance.conflict_resolve", entity: "attendance_session", entityId,
        oldValue: { status: "open", entries: saved }, newValue: { status: "kept", entries: saved },
      });
      return {};
    }

    if (c.sessionId) {
      await tx.delete(attendanceEntry).where(eq(attendanceEntry.sessionId, c.sessionId));
      await tx.update(attendanceSession).set({ editedAt: new Date(p.editedAt) }).where(eq(attendanceSession.id, c.sessionId));
    } else {
      const [dup] = await tx.select({ id: attendanceSession.id }).from(attendanceSession).where(and(
        eq(attendanceSession.batchId, p.batchId), eq(attendanceSession.subjectId, p.subjectId),
        eq(attendanceSession.date, p.date), eq(attendanceSession.period, p.period),
      ));
      if (dup) return { error: "This class was saved meanwhile. Refresh and check it." };
      await tx.insert(attendanceSession).values({
        id: p.sessionId, batchId: p.batchId, subjectId: p.subjectId, date: p.date, period: p.period,
        periodCount: p.periodCount, facultyId: c.facultyId, editedAt: new Date(p.editedAt),
      });
    }
    await tx.insert(attendanceEntry).values(p.entries.map((e) => ({ ...e, sessionId: entityId })));
    await tx.update(syncConflict).set({ status: "replaced", ...resolved }).where(eq(syncConflict.id, c.id));
    await audit(tx, v, {
      action: "attendance.conflict_resolve", entity: "attendance_session", entityId,
      oldValue: { status: "open", entries: saved }, newValue: { status: "replaced", entries: p.entries },
    });
    return {};
  });
  revalidatePath("/attendance");
  revalidatePath("/students");
  return result;
}
