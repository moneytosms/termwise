"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { istDate } from "@/domain/attendance";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { requireParent, requireStudent } from "@/server/portal";
import { leaveRequest } from "@/server/schema";
import { dayCount, PENDING, shiftDate } from "./shared";

const isDate = (s: string) => {
  const t = Date.parse(s);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
};

const applySchema = z.object({
  kind: z.enum(["leave", "medical"]),
  fromDate: z.string().refine(isDate, "Pick a valid start date."),
  toDate: z.string().refine(isDate, "Pick a valid end date."),
  reason: z.string().trim().min(5, "Give a reason of at least 5 characters.").max(500, "Reason must be 500 characters or fewer."),
}).superRefine((d, ctx) => {
  if (!isDate(d.fromDate) || !isDate(d.toDate)) return;
  if (d.toDate < d.fromDate) ctx.addIssue({ code: "custom", message: "End date is before start date.", path: ["toDate"] });
  else if (dayCount(d.fromDate, d.toDate) > 31) ctx.addIssue({ code: "custom", message: "Leave can be up to 31 days.", path: ["toDate"] });
  if (d.fromDate < shiftDate(istDate(), -7)) ctx.addIssue({ code: "custom", message: "Leave can start up to a week ago.", path: ["fromDate"] });
});

export async function applyLeave(input: { kind: string; fromDate: string; toDate: string; reason: string }): Promise<{ error?: string }> {
  const v = await requireStudent();
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  await db.transaction(async (tx) => {
    const [row] = await tx.insert(leaveRequest).values({
      studentId: v.studentId, kind: d.kind, fromDate: d.fromDate, toDate: d.toDate, reason: d.reason,
    }).returning({ id: leaveRequest.id });
    await audit(tx, v, { action: "leave.apply", entity: "leave_request", entityId: row.id, newValue: { kind: d.kind, fromDate: d.fromDate, toDate: d.toDate } });
  });
  revalidatePath("/my/leave");
  revalidatePath("/my");
  return {};
}

const idSchema = z.number().int().positive();

/** Student withdraws their own request while a parent or mentor still has it. */
export async function withdrawLeave(id: number): Promise<{ error?: string }> {
  const v = await requireStudent();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { error: "Request not found." };

  const error = await db.transaction(async (tx) => {
    const [row] = await tx.select({ id: leaveRequest.id, status: leaveRequest.status }).from(leaveRequest)
      .where(and(eq(leaveRequest.id, parsed.data), eq(leaveRequest.studentId, v.studentId), inArray(leaveRequest.status, [...PENDING])))
      .for("update");
    if (!row) return "Only a pending request can be withdrawn.";
    await tx.update(leaveRequest).set({ status: "withdrawn" }).where(eq(leaveRequest.id, row.id));
    await audit(tx, v, { action: "leave.withdraw", entity: "leave_request", entityId: row.id, oldValue: { status: row.status }, newValue: { status: "withdrawn" } });
    return null;
  });
  if (error) return { error };
  revalidatePath("/my/leave");
  revalidatePath("/my");
  return {};
}

const decideSchema = z.object({
  id: z.number().int().positive(),
  note: z.string().trim().max(500, "Note must be 500 characters or fewer.").optional(),
});

/** Parent approves (to mentor) or rejects a request for their active child. */
export async function parentDecide(id: number, approve: boolean, note?: string): Promise<{ error?: string }> {
  const v = await requireParent();
  const parsed = decideSchema.safeParse({ id, note });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const text = parsed.data.note || null;

  const error = await db.transaction(async (tx) => {
    const [row] = await tx.select({ id: leaveRequest.id, studentId: leaveRequest.studentId }).from(leaveRequest)
      .where(and(eq(leaveRequest.id, parsed.data.id), eq(leaveRequest.studentId, v.studentId), eq(leaveRequest.status, "pending_parent")))
      .for("update");
    if (!row || !v.children.some((c) => c.id === row.studentId)) return "This request isn't waiting for your approval.";
    const now = new Date();
    const status = approve ? "pending_mentor" : "rejected";
    await tx.update(leaveRequest).set({ status, parentNote: text, decidedAt: approve ? null : now }).where(eq(leaveRequest.id, row.id));
    await audit(tx, v, { action: "leave.parent_decision", entity: "leave_request", entityId: row.id, newValue: { status, parentNote: text } });
    return null;
  });
  if (error) return { error };
  revalidatePath("/my/leave");
  revalidatePath("/my");
  return {};
}
