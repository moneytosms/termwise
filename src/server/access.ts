import { and, eq, or, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { batch, programme, staff, student, subject } from "./schema";

export type Viewer = {
  userId: string;
  name: string;
  staffId: number;
  campusId: number;
  departmentId: number | null;
  role: "faculty" | "office_admin";
};

export class AccessError extends Error {}

/** The signed-in staff member, or null. Use in route handlers, which answer 401 themselves. */
export async function getViewer(): Promise<Viewer | null> {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const [row] = await db.select().from(staff).where(eq(staff.userId, s.user.id));
  if (!row) return null;
  return {
    userId: s.user.id, name: row.name, staffId: row.id, campusId: row.campusId,
    departmentId: row.departmentId, role: row.role,
  };
}

/** For pages and server actions: redirects to sign-in when signed out. */
export async function requireViewer(): Promise<Viewer> {
  return (await getViewer()) ?? redirect("/sign-in");
}

/** For office-admin-only pages and actions. */
export async function requireAdmin(): Promise<Viewer> {
  const v = await requireViewer();
  if (v.role !== "office_admin") redirect("/home");
  return v;
}

/**
 * Students this viewer may see, as a Drizzle condition on `student`.
 * Admin: everyone on their campus. Faculty: their subjects' batches plus their mentees.
 * Join `batch` and `programme` when using it.
 */
export function studentScope(v: Viewer) {
  const onCampus = eq(programme.campusId, v.campusId);
  if (v.role === "office_admin") return onCampus;
  const teaches = db.select({ id: subject.batchId }).from(subject).where(eq(subject.facultyId, v.staffId));
  return and(onCampus, or(inArray(student.batchId, teaches), eq(student.mentorId, v.staffId)));
}

/** Throws unless the viewer may see this student. */
export async function assertStudentAccess(v: Viewer, studentId: number) {
  const [row] = await db.select({ n: sql<number>`1` }).from(student)
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(student.id, studentId), studentScope(v)));
  if (!row) throw new AccessError("Not your student");
}

/** Throws unless the viewer teaches this subject, or is an admin on its campus. */
export async function assertSubjectAccess(v: Viewer, subjectId: number) {
  const [row] = await db.select({ facultyId: subject.facultyId, campusId: programme.campusId }).from(subject)
    .innerJoin(batch, eq(subject.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(eq(subject.id, subjectId));
  if (!row || row.campusId !== v.campusId) throw new AccessError("Not on your campus");
  if (v.role !== "office_admin" && row.facultyId !== v.staffId) throw new AccessError("Not your subject");
}
