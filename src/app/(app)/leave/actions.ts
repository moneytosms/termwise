"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { applyError, dayCount } from "@/domain/staff-leave";
import { requireAdmin, requireViewer } from "@/server/access";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { staff, staffLeave } from "@/server/schema";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.").refine((s) => !Number.isNaN(Date.parse(s)), "Pick a real date.");
const applySchema = z.object({
  kind: z.enum(["casual", "medical", "on_duty"]),
  from: isoDate,
  to: isoDate,
  reason: z.string().trim().min(5, "Give a reason of at least 5 characters.").max(500, "Keep the reason to 500 characters or fewer."),
});
const decideSchema = z.object({
  id: z.number().int().positive(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(500, "Keep the note to 500 characters or fewer."),
});

/** Any staff member applies for their own leave. */
export async function applyLeave(input: { kind: string; from: string; to: string; reason: string }): Promise<{ error?: string }> {
  const v = await requireViewer();
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { kind, from, to, reason } = parsed.data;

  const error = await db.transaction(async (tx) => {
    // Locks the staff row so two applies from the same person can't both pass the overlap check.
    await tx.select({ id: staff.id }).from(staff).where(eq(staff.id, v.staffId)).for("update");
    const mine = await tx.select({ kind: staffLeave.kind, fromDate: staffLeave.fromDate, toDate: staffLeave.toDate, status: staffLeave.status })
      .from(staffLeave).where(eq(staffLeave.staffId, v.staffId));
    const problem = applyError({ kind, fromDate: from, toDate: to }, mine);
    if (problem) return problem;

    const [row] = await tx.insert(staffLeave).values({ staffId: v.staffId, kind, fromDate: from, toDate: to, reason }).returning({ id: staffLeave.id });
    await audit(tx, v, {
      action: "staff_leave.apply", entity: "staff_leave", entityId: row.id,
      newValue: { kind, fromDate: from, toDate: to, days: dayCount(from, to) },
    });
    return null;
  });
  if (error) return { error };
  revalidatePath("/leave");
  revalidatePath("/classes");
  return {};
}

/** Only the person's own pending leave can be withdrawn. */
export async function withdrawLeave(id: number): Promise<{ error?: string }> {
  const v = await requireViewer();
  const parsed = z.number().int().positive().safeParse(id);
  if (!parsed.success) return { error: "Leave not found." };

  const error = await db.transaction(async (tx) => {
    const [row] = await tx.update(staffLeave).set({ status: "withdrawn" })
      .where(and(eq(staffLeave.id, parsed.data), eq(staffLeave.staffId, v.staffId), eq(staffLeave.status, "pending")))
      .returning({ id: staffLeave.id });
    if (!row) return "Only your pending leave can be withdrawn.";
    await audit(tx, v, {
      action: "staff_leave.withdraw", entity: "staff_leave", entityId: row.id,
      oldValue: { status: "pending" }, newValue: { status: "withdrawn" },
    });
    return null;
  });
  if (error) return { error };
  revalidatePath("/leave");
  revalidatePath("/classes");
  return {};
}

/** Office admin decides pending leave of staff on the same campus. Nobody decides their own. */
export async function decideLeave(input: { id: number; decision: "approved" | "rejected"; note: string }): Promise<{ error?: string }> {
  const v = await requireAdmin();
  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, decision } = parsed.data;
  const note = parsed.data.note || null;
  if (decision === "rejected" && !note) return { error: "Say why you are rejecting this leave." };

  const error = await db.transaction(async (tx) => {
    const [row] = await tx.select({
      id: staffLeave.id, staffId: staffLeave.staffId, kind: staffLeave.kind, fromDate: staffLeave.fromDate,
      toDate: staffLeave.toDate, status: staffLeave.status, campusId: staff.campusId,
    }).from(staffLeave)
      .innerJoin(staff, eq(staffLeave.staffId, staff.id))
      .where(eq(staffLeave.id, id))
      .for("update", { of: staffLeave });
    if (!row || row.campusId !== v.campusId) return "Leave request not found on your campus.";
    if (row.staffId === v.staffId) return "You can't decide your own leave.";
    if (row.status !== "pending") return "This leave is no longer pending.";

    if (decision === "approved") {
      const others = await tx.select({ kind: staffLeave.kind, fromDate: staffLeave.fromDate, toDate: staffLeave.toDate, status: staffLeave.status })
        .from(staffLeave).where(and(eq(staffLeave.staffId, row.staffId), ne(staffLeave.id, id), inArray(staffLeave.status, ["pending", "approved"])));
      const problem = applyError({ kind: row.kind, fromDate: row.fromDate, toDate: row.toDate }, others);
      if (problem) return problem;
    }

    await tx.update(staffLeave).set({ status: decision, note, decidedById: v.staffId, decidedAt: new Date() }).where(eq(staffLeave.id, id));
    await audit(tx, v, {
      action: decision === "approved" ? "staff_leave.approve" : "staff_leave.reject", entity: "staff_leave", entityId: id,
      oldValue: { status: "pending" }, newValue: { status: decision, note },
    });
    return null;
  });
  if (error) return { error };
  revalidatePath("/leave");
  revalidatePath("/classes");
  return {};
}
