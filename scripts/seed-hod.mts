import { and, eq } from "drizzle-orm";
import { auth } from "../src/server/auth";
import { db } from "../src/server/db";
import * as t from "../src/server/schema";

const HODS = [
  { department: "Computer Science", email: "cse.hod@termwise.demo", name: "Dr. Soumya Ranjan Panigrahi" },
  { department: "Mechanical", email: "me.hod@termwise.demo", name: "Dr. Bhabani Shankar Nayak" },
];

async function login(name: string, email: string, password: string) {
  const [existing] = await db.select({ id: t.user.id }).from(t.user).where(eq(t.user.email, email));
  if (existing) return existing.id;
  const { user } = await auth.api.signUpEmail({ body: { name, email, password } });
  return user.id;
}

// Idempotent: one head of department for CSE and one for Mechanical on the Engineering campus.
export async function seedHod(password: string) {
  const [eng] = await db.select({ id: t.campus.id }).from(t.campus).where(eq(t.campus.code, "ENG"));
  for (const h of HODS) {
    const [d] = await db.select({ id: t.department.id }).from(t.department).where(and(eq(t.department.campusId, eng.id), eq(t.department.name, h.department)));
    if (!d) continue;
    const userId = await login(h.name, h.email, password);
    const [have] = await db.select({ id: t.staff.id }).from(t.staff).where(and(eq(t.staff.userId, userId), eq(t.staff.campusId, eng.id)));
    if (!have) await db.insert(t.staff).values({ userId, campusId: eng.id, departmentId: d.id, name: h.name, role: "hod" });
  }
}
