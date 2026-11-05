import { and, eq, or, inArray, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { getPortalViewer } from "./portal";
import { batch, programme, staff, student, subject } from "./schema";
import { CAMPUS_COOKIE, resolveActiveRow } from "@/domain/active-campus";
import { can, type Capability, type StaffRole } from "@/domain/roles";
import { departmentLimit } from "@/domain/department-scope";

export type Viewer = {
  userId: string;
  name: string;
  staffId: number;
  campusId: number;
  departmentId: number | null;
  role: StaffRole;
};

export class AccessError extends Error {}

type StaffSession = { userId: string; row: typeof staff.$inferSelect };

/** All staff rows of the signed-in user (one per campus), by id. */
export async function myStaffRows() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const rows = await db.select().from(staff).where(eq(staff.userId, s.user.id)).orderBy(staff.id);
  return { userId: s.user.id, rows };
}

/** The signed-in user's active staff row (the campus they chose, else the first), or null. */
async function staffSession(): Promise<StaffSession | null> {
  const mine = await myStaffRows();
  if (!mine) return null;
  if (mine.rows.some((r) => r.role === "trust")) return { userId: mine.userId, row: mine.rows.find((r) => r.role === "trust")! };
  const row = resolveActiveRow(mine.rows, (await cookies()).get(CAMPUS_COOKIE)?.value);
  return row ? { userId: mine.userId, row } : null;
}

/** The signed-in user's viewer as one specific staff row of theirs (not necessarily the active one), or null. */
export async function getViewerAs(staffId: number): Promise<Viewer | null> {
  const mine = await myStaffRows();
  const row = mine?.rows.find((r) => r.id === staffId);
  return mine && row ? viewerFrom({ userId: mine.userId, row }) : null;
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

/** For pages and actions that need a capability: other staff go to /home. */
export async function requireCan(cap: Capability): Promise<Viewer> {
  const v = await requireViewer();
  if (!can(v.role, cap)) redirect("/home");
  return v;
}

/**
 * Programmes this viewer may see, as a Drizzle condition on `programme`: their campus,
 * and for a head of department only their own department.
 */
export function programmeScope(v: Viewer) {
  const onCampus = eq(programme.campusId, v.campusId);
  const limit = departmentLimit(v);
  if (limit === null) return onCampus;
  return and(onCampus, limit === "none" ? sql`false` : eq(programme.departmentId, limit));
}

/**
 * Students this viewer may see, as a Drizzle condition on `student`.
 * Admin: everyone on their campus. Faculty: their subjects' batches plus their mentees.
 * Join `batch` and `programme` when using it.
 */
export function studentScope(v: Viewer) {
  const onCampus = programmeScope(v);
  if (can(v.role, "campus_students") || can(v.role, "dept_students")) return onCampus;
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
  if (!can(v.role, "moderate_marks") && row.facultyId !== v.staffId) throw new AccessError("Not your subject");
}

/** Read access to a subject: as assertSubjectAccess, and a head of department also sees subjects of their department. */
export async function assertSubjectView(v: Viewer, subjectId: number) {
  if (!can(v.role, "marks_view")) return assertSubjectAccess(v, subjectId);
  const [row] = await db.select({ n: sql<number>`1` }).from(subject)
    .innerJoin(batch, eq(subject.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(subject.id, subjectId), programmeScope(v)));
  if (!row) throw new AccessError("Not in your department");
}
