"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canAppeal, validateReason } from "@/domain/appeals";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { requirePortal } from "@/server/portal";
import { portalStudent } from "@/server/portal-data";
import { appeal, attendanceEntry, attendanceSession, mark, markComponent, subject } from "@/server/schema";

const input = z.object({
  kind: z.enum(["mark", "attendance"]),
  componentId: z.coerce.number().int().positive().optional(),
  sessionId: z.uuid().optional(),
  reason: z.string(),
});

/** Student contests a mark or an absent/late attendance entry of their own batch. One open appeal per item. */
export async function raiseAppeal(formData: FormData): Promise<{ error?: string }> {
  const v = await requirePortal();
  if (v.role !== "student") return { error: "Only the student can raise an appeal." };
  const parsed = input.safeParse({
    kind: formData.get("kind"),
    componentId: formData.get("componentId") || undefined,
    sessionId: formData.get("sessionId") || undefined,
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: "Check the appeal details." };
  const d = parsed.data;
  const reasonError = validateReason(d.reason);
  if (reasonError) return { error: reasonError };
  const me = await portalStudent(v.studentId);
  if (!me) return { error: "Student not found." };

  const error = await db.transaction(async (tx): Promise<string | null> => {
    let status: "present" | "absent" | "late" | undefined;
    if (d.kind === "mark") {
      const [item] = await tx.select({ marks: mark.marks }).from(markComponent)
        .innerJoin(subject, eq(markComponent.subjectId, subject.id))
        .leftJoin(mark, and(eq(mark.componentId, markComponent.id), eq(mark.studentId, v.studentId)))
        .where(and(eq(markComponent.id, d.componentId!), eq(subject.batchId, me.batchId)));
      if (!item || item.marks === null) return "Only a mark that has been entered can be appealed.";
    } else {
      const [item] = await tx.select({ status: attendanceEntry.status }).from(attendanceSession)
        .innerJoin(attendanceEntry, and(eq(attendanceEntry.sessionId, attendanceSession.id), eq(attendanceEntry.studentId, v.studentId)))
        .where(and(eq(attendanceSession.id, d.sessionId!), eq(attendanceSession.batchId, me.batchId)));
      if (!item) return "That class isn't in your register.";
      status = item.status;
    }
    const [open] = await tx.select({ id: appeal.id }).from(appeal).where(and(
      eq(appeal.studentId, v.studentId), eq(appeal.kind, d.kind), eq(appeal.status, "open"),
      d.kind === "mark" ? eq(appeal.componentId, d.componentId!) : eq(appeal.sessionId, d.sessionId!),
    ));
    if (!canAppeal({ role: v.role, existingOpen: Boolean(open), kind: d.kind, status })) return "This can't be appealed.";

    const [row] = await tx.insert(appeal).values({
      studentId: v.studentId, kind: d.kind, componentId: d.componentId ?? null, sessionId: d.sessionId ?? null, reason: d.reason.trim(),
    }).returning({ id: appeal.id });
    await audit(tx, v, { action: "appeal.raise", entity: "appeal", entityId: row.id, newValue: { kind: d.kind, componentId: d.componentId ?? null, sessionId: d.sessionId ?? null } });
    return null;
  });
  if (error) return { error };
  revalidatePath("/my/marks");
  revalidatePath("/my/attendance");
  revalidatePath("/my");
  revalidatePath("/requests");
  return {};
}
