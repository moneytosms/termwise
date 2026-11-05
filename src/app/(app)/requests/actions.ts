"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/server/access";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { batch, leaveRequest, portalRequest, programme, student } from "@/server/schema";
import { can } from "@/domain/roles";

const id = z.number().int().positive();
const note = z.string().trim().max(500, "Keep it to 500 characters or fewer.");

const decideSchema = z.object({ id, decision: z.enum(["approved", "rejected"]), note });
const closeSchema = z.object({ id, reply: note });

/** Mentor decides a mentee's leave that is waiting for them. */
export async function decideLeave(input: { id: number; decision: "approved" | "rejected"; note: string }): Promise<{ error?: string }> {
  const v = await requireViewer();
  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { decision } = parsed.data;
  const leaveId = parsed.data.id;
  const mentorNote = parsed.data.note || null;

  const error = await db.transaction(async (tx) => {
    const [row] = await tx.select({ id: leaveRequest.id, status: leaveRequest.status }).from(leaveRequest)
      .innerJoin(student, eq(leaveRequest.studentId, student.id))
      .where(and(eq(leaveRequest.id, leaveId), eq(student.mentorId, v.staffId)))
      .for("update", { of: leaveRequest });
    if (!row) return "That request isn't from one of your mentees.";
    if (row.status !== "pending_mentor") return "This request is no longer waiting for you.";

    await tx.update(leaveRequest).set({ status: decision, mentorNote, decidedAt: new Date() }).where(eq(leaveRequest.id, leaveId));
    await audit(tx, v, {
      action: "leave.mentor_decision", entity: "leave_request", entityId: leaveId,
      oldValue: { status: row.status }, newValue: { status: decision, mentorNote },
    });
    return null;
  });
  if (error) return { error };
  revalidatePath("/requests");
  return {};
}

/** Closes a parent's note (the mentor of that student) or a record correction (office admin, same campus). */
export async function closeRequest(input: { id: number; reply: string }): Promise<{ error?: string }> {
  const v = await requireViewer();
  const parsed = closeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const requestId = parsed.data.id;
  const reply = parsed.data.reply || null;

  const error = await db.transaction(async (tx) => {
    const [row] = await tx.select({
      id: portalRequest.id, kind: portalRequest.kind, status: portalRequest.status,
      mentorId: student.mentorId, campusId: programme.campusId,
    }).from(portalRequest)
      .innerJoin(student, eq(portalRequest.studentId, student.id))
      .innerJoin(batch, eq(student.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(eq(portalRequest.id, requestId))
      .for("update", { of: portalRequest });
    if (!row) return "Request not found.";
    const allowed = row.kind === "mentor_note"
      ? row.mentorId === v.staffId
      : can(v.role, "office_requests") && row.campusId === v.campusId;
    if (!allowed) return "This isn't yours to close.";
    if (row.status !== "open") return "Already marked done.";

    await tx.update(portalRequest).set({ status: "done", reply, closedAt: new Date() }).where(eq(portalRequest.id, requestId));
    await audit(tx, v, {
      action: "request.close", entity: "portal_request", entityId: requestId,
      oldValue: { status: row.status }, newValue: { status: "done", kind: row.kind, reply },
    });
    return null;
  });
  if (error) return { error };
  revalidatePath("/requests");
  return {};
}
