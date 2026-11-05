import { and, eq } from "drizzle-orm";
import { auth } from "../src/server/auth";
import { db } from "../src/server/db";
import * as t from "../src/server/schema";

async function login(name: string, email: string, password: string) {
  const [existing] = await db.select({ id: t.user.id }).from(t.user).where(eq(t.user.email, email));
  if (existing) return existing.id;
  const { user } = await auth.api.signUpEmail({ body: { name, email, password } });
  return user.id;
}

async function campusId(code: string) {
  const [c] = await db.select({ id: t.campus.id }).from(t.campus).where(eq(t.campus.code, code));
  return c.id;
}

/** The user's staff row on a campus, created if missing. */
async function row(userId: string, name: string, campus: number, role: "faculty" | "office_admin", departmentId: number | null) {
  const [have] = await db.select({ id: t.staff.id }).from(t.staff).where(and(eq(t.staff.userId, userId), eq(t.staff.campusId, campus)));
  if (have) return have.id;
  const [s] = await db.insert(t.staff).values({ userId, campusId: campus, departmentId, name, role }).returning({ id: t.staff.id });
  return s.id;
}

async function teach(code: string, staffId: number) {
  await db.update(t.subject).set({ facultyId: staffId }).where(eq(t.subject.code, code));
}

async function dept(campus: number, name: string) {
  const [d] = await db.select({ id: t.department.id }).from(t.department).where(and(eq(t.department.campusId, campus), eq(t.department.name, name)));
  return d?.id ?? null;
}

// Idempotent backfill: a visiting faculty on ENG and MGT, and one person who is faculty on ENG and office admin on PHR.
export async function seedCampusRoles(password: string) {
  const [eng, mgt, phr] = [await campusId("ENG"), await campusId("MGT"), await campusId("PHR")];

  const visitName = "Prakash Chandra Rout";
  const visitor = await login(visitName, "visiting.faculty@termwise.demo", password);
  const visitEng = await row(visitor, visitName, eng, "faculty", await dept(eng, "Mechanical"));
  const visitMgt = await row(visitor, visitName, mgt, "faculty", null);
  await teach("ME301", visitEng);
  await teach("MB102", visitMgt);

  const dualName = "Anjali Mohanty";
  const dual = await login(dualName, "dual.role@termwise.demo", password);
  const dualEng = await row(dual, dualName, eng, "faculty", await dept(eng, "Computer Science"));
  await row(dual, dualName, phr, "office_admin", null);
  await teach("CS304", dualEng);
}
