import { and, eq, or, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { getPortalViewer } from "./portal";
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

type StaffSession = { userId: string; row: typeof staff.$inferSelect };

/** The signed-in user's staff row, any role, or null. */
async function staffSession(): Promise<StaffSession | null> {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const [row] = await db.select().from(staff).where(eq(staff.userId, s.user.id));
  return row ? { userId: s.user.id, row } : null;
}

/** Trust staff get no staff viewer: every staff page and action rejects them. */
function viewerFrom(s: StaffSession | null): Viewer | null {
  if (!s || s.row.role === "trust") return null;
  return {
    userId: s.userId, name: s.row.name, staffId: s.row.id, campusId: s.row.campusId,
    departmentId: s.row.departmentId, role: s.row.role,
  };
}

/** The signed-in staff member, or null. Use in route handlers, which answer 401 themselves. */
export async function getViewer(): Promise<Viewer | null> {
  return viewerFrom(await staffSession());
}

/** For pages and server actions: redirects to sign-in when signed out, and students/parents to their portal. */
export async function requireViewer(): Promise<Viewer> {
  const s = await staffSession();
  if (s?.row.role === "trust") redirect("/trust");
  const v = viewerFrom(s);
  if (v) return v;
  redirect((await getPortalViewer()) ? "/my" : "/sign-in");
}

/** For the trust area: the trust staff member. Other users go to /home, or to sign-in when signed out. */
export async function requireTrust() {
  const s = await staffSession();
  if (s?.row.role === "trust") return { userId: s.userId, name: s.row.name, staffId: s.row.id };
  redirect(viewerFrom(s) ? "/home" : "/sign-in");
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
