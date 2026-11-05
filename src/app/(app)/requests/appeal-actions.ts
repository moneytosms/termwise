"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { decide } from "@/domain/appeals";
import type { AttendanceStatus } from "@/domain/attendance";
import { validateMark } from "@/domain/marks";
import { AccessError, assertSubjectAccess, requireViewer } from "@/server/access";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { appeal, attendanceEntry, attendanceSession, mark, markComponent } from "@/server/schema";

const input = z.object({
  id: z.number().int().positive(),
  action: z.enum(["accept", "reject"]),
  response: z.string().trim().max(500, "Keep the response to 500 characters or fewer."),
  newValue: z.union([z.number(), z.enum(["present", "absent", "late"])]).optional(),
});

/**
 * Decides an appeal. Accept needs the corrected value: marks (0..max) or attendance status.
 * Faculty may decide appeals on subjects they teach; office admins on any campus subject.
 */
export async function decideAppeal(
  id: number, action: "accept" | "reject", response: string, newValue?: number | AttendanceStatus,
): Promise<{ error?: string }> {
  const v = await requireViewer();
  const parsed = input.safeParse({ id, action, response, newValue });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const [row] = await db.select({
    kind: appeal.kind, studentId: appeal.studentId, componentId: appeal.componentId, sessionId: appeal.sessionId,
    subjectId: sql<number>`coalesce(${markComponent.subjectId}, ${attendanceSession.subjectId})`, max: markComponent.maxMarks,
  }).from(appeal)
    .leftJoin(markComponent, eq(appeal.componentId, markComponent.id))
    .leftJoin(attendanceSession, eq(appeal.sessionId, attendanceSession.id))
    .where(eq(appeal.id, d.id));
  if (!row) return { error: "Appeal not found." };
  try {
    await assertSubjectAccess(v, row.subjectId);
  } catch (e) {
    if (e instanceof AccessError) return { error: e.message };
    throw e;
  }

  const isMark = row.kind === "mark";
  if (d.action === "accept") {
    if (isMark ? typeof d.newValue !== "number" : typeof d.newValue !== "string") {
      return { error: isMark ? "Enter the corrected marks." : "Choose the corrected status." };
    }
    const err = isMark ? validateMark(d.newValue as number, row.max ?? 0) : null;
    if (err) return { error: err };
  }

  const error = await db.transaction(async (tx): Promise<string | null> => {
    const [cur] = await tx.select({ status: appeal.status }).from(appeal).where(eq(appeal.id, d.id)).for("update");
    const t = decide(cur.status, d.action, d.response);
    if (!t.ok) return t.error;

    if (d.action === "accept" && isMark) {
      // Accepted appeals may change a mark after the draft-only lock; nothing else does.
      const [before] = await tx.select({ marks: mark.marks }).from(mark)
        .where(and(eq(mark.componentId, row.componentId!), eq(mark.studentId, row.studentId)));
      await tx.update(mark).set({ marks: d.newValue as number })
        .where(and(eq(mark.componentId, row.componentId!), eq(mark.studentId, row.studentId)));
      await audit(tx, v, {
        action: "marks.appeal_change", entity: "subject", entityId: row.subjectId,
        oldValue: { [`${row.componentId}:${row.studentId}`]: before?.marks ?? null },
        newValue: { [`${row.componentId}:${row.studentId}`]: d.newValue }, reason: `Appeal ${d.id}`,
      });
    }
    if (d.action === "accept" && !isMark) {
      const [before] = await tx.select({ status: attendanceEntry.status }).from(attendanceEntry)
        .where(and(eq(attendanceEntry.sessionId, row.sessionId!), eq(attendanceEntry.studentId, row.studentId)));
      await tx.update(attendanceEntry).set({ status: d.newValue as AttendanceStatus })
        .where(and(eq(attendanceEntry.sessionId, row.sessionId!), eq(attendanceEntry.studentId, row.studentId)));
      await tx.update(attendanceSession).set({ editedAt: new Date() }).where(eq(attendanceSession.id, row.sessionId!));
      await audit(tx, v, {
        action: "attendance.appeal_change", entity: "attendance_session", entityId: row.sessionId!,
        oldValue: { [row.studentId]: before?.status ?? null }, newValue: { [row.studentId]: d.newValue }, reason: `Appeal ${d.id}`,
      });
    }

    await tx.update(appeal).set({ status: t.to, response: d.response || null, resolvedBy: v.userId, resolvedAt: new Date() })
      .where(eq(appeal.id, d.id));
    await audit(tx, v, {
      action: "appeal.decide", entity: "appeal", entityId: d.id,
      oldValue: { status: cur.status }, newValue: { status: t.to, response: d.response || null }, reason: d.response || undefined,
    });
    return null;
  });
  if (error) return { error };
  for (const p of ["/requests", "/marks", "/attendance", "/my/marks", "/my/attendance", "/my"]) revalidatePath(p);
  return {};
}
