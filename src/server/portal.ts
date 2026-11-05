import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { batch, guardian, guardianStudent, programme, student } from "./schema";

/** Parent's chosen child; only ever used to pick among the parent's own linked children. */
export const CHILD_COOKIE = "termwise_child";

type Child = { id: number; name: string; rollNo: string; relation: string | null };

/**
 * A signed-in student or parent. `studentId` is the one student every portal page shows:
 * the student themself, or the parent's active child. Never take a student id from the client.
 */
export type PortalViewer = {
  userId: string;
  name: string;
  role: "student" | "parent";
  guardianId: number | null;
  children: Child[];
  studentId: number;
  campusId: number;
  mentorId: number | null;
};

export async function getPortalViewer(): Promise<PortalViewer | null> {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const cols = { id: student.id, name: student.name, rollNo: student.rollNo, campusId: programme.campusId, mentorId: student.mentorId };
  const [self] = await db.select(cols).from(student)
    .innerJoin(batch, eq(student.batchId, batch.id)).innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(eq(student.userId, s.user.id));
  if (self) {
    return { userId: s.user.id, name: self.name, role: "student", guardianId: null, children: [], studentId: self.id, campusId: self.campusId, mentorId: self.mentorId };
  }
  const [g] = await db.select().from(guardian).where(eq(guardian.userId, s.user.id));
  if (!g) return null;
  const kids = await db.select({ ...cols, relation: guardianStudent.relation }).from(guardianStudent)
    .innerJoin(student, eq(guardianStudent.studentId, student.id))
    .innerJoin(batch, eq(student.batchId, batch.id)).innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(eq(guardianStudent.guardianId, g.id)).orderBy(student.name);
  if (!kids.length) return null;
  const want = Number((await cookies()).get(CHILD_COOKIE)?.value);
  const active = kids.find((k) => k.id === want) ?? kids[0];
  return {
    userId: s.user.id, name: g.name, role: "parent", guardianId: g.id,
    children: kids.map(({ id, name, rollNo, relation }) => ({ id, name, rollNo, relation })),
    studentId: active.id, campusId: active.campusId, mentorId: active.mentorId,
  };
}

/** For portal pages and actions: redirects to sign-in when signed out or not a student/parent. */
export async function requirePortal(): Promise<PortalViewer> {
  return (await getPortalViewer()) ?? redirect("/sign-in");
}

export async function requireParent(): Promise<PortalViewer & { guardianId: number }> {
  const v = await requirePortal();
  if (v.role !== "parent" || v.guardianId === null) redirect("/my");
  return v as PortalViewer & { guardianId: number };
}

export async function requireStudent(): Promise<PortalViewer> {
  const v = await requirePortal();
  if (v.role !== "student") redirect("/my");
  return v;
}
