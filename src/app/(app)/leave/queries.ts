import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { can } from "@/domain/roles";
import type { Viewer } from "@/server/access";
import { db } from "@/server/db";
import { staff, staffLeave } from "@/server/schema";

/** Every leave of the viewer, newest first. */
export function myLeave(v: Viewer) {
  return db.select({
    id: staffLeave.id, kind: staffLeave.kind, fromDate: staffLeave.fromDate, toDate: staffLeave.toDate,
    reason: staffLeave.reason, status: staffLeave.status, note: staffLeave.note,
  }).from(staffLeave)
    .where(eq(staffLeave.staffId, v.staffId))
    .orderBy(desc(staffLeave.fromDate), desc(staffLeave.id));
}

/** Pending leave of this campus's staff, the leave they already hold, and recent decisions. */
export async function campusLeave(v: Viewer) {
  // A head of department sees only faculty of their own department; the office sees the whole campus.
  const scope = can(v.role, "staff_leave") ? eq(staff.campusId, v.campusId)
    : v.departmentId === null ? sql`false`
    : and(eq(staff.campusId, v.campusId), eq(staff.departmentId, v.departmentId), eq(staff.role, "faculty"), ne(staff.id, v.staffId));
  const decider = alias(staff, "decider");
  const pending = await db.select({
    id: staffLeave.id, staffId: staffLeave.staffId, staffName: staff.name, kind: staffLeave.kind,
    fromDate: staffLeave.fromDate, toDate: staffLeave.toDate, reason: staffLeave.reason,
  }).from(staffLeave)
    .innerJoin(staff, eq(staffLeave.staffId, staff.id))
    .where(and(scope, eq(staffLeave.status, "pending")))
    .orderBy(asc(staffLeave.fromDate), asc(staffLeave.id));

  const staffIds = [...new Set(pending.map((p) => p.staffId))];
  const held = staffIds.length === 0 ? [] : await db.select({
    id: staffLeave.id, staffId: staffLeave.staffId, kind: staffLeave.kind,
    fromDate: staffLeave.fromDate, toDate: staffLeave.toDate, status: staffLeave.status,
  }).from(staffLeave)
    .where(and(inArray(staffLeave.staffId, staffIds), inArray(staffLeave.status, ["pending", "approved"])));

  const decided = await db.select({
    id: staffLeave.id, staffName: staff.name, kind: staffLeave.kind, fromDate: staffLeave.fromDate, toDate: staffLeave.toDate,
    status: staffLeave.status, note: staffLeave.note, decidedBy: decider.name,
  }).from(staffLeave)
    .innerJoin(staff, eq(staffLeave.staffId, staff.id))
    .leftJoin(decider, eq(staffLeave.decidedById, decider.id))
    .where(and(scope, inArray(staffLeave.status, ["approved", "rejected"])))
    .orderBy(desc(staffLeave.decidedAt), desc(staffLeave.id))
    .limit(20);

  return { pending, held, decided };
}
