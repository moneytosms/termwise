import { and, eq } from "drizzle-orm";
import { auth } from "../src/server/auth";
import { db } from "../src/server/db";
import * as t from "../src/server/schema";

type Role = "admissions" | "exams" | "accounts" | "hr";

// One of each office role per campus.
const PEOPLE: { campus: string; prefix: string; names: Record<Role, string> }[] = [
  { campus: "ENG", prefix: "eng", names: { admissions: "Smita Pattnaik", exams: "Nirakar Behera", accounts: "Jyotirmayee Sahu", hr: "Bikash Chandra Dash" } },
  { campus: "MGT", prefix: "mgt", names: { admissions: "Gitanjali Mohapatra", exams: "Rabindra Nath Satpathy", accounts: "Manasi Routray", hr: "Tapan Kumar Swain" } },
  { campus: "PHR", prefix: "phr", names: { admissions: "Pratyusha Nanda", exams: "Santosh Kumar Barik", accounts: "Sumitra Pradhan", hr: "Alok Ranjan Mahapatra" } },
];

async function login(name: string, email: string, password: string) {
  const [existing] = await db.select({ id: t.user.id }).from(t.user).where(eq(t.user.email, email));
  if (existing) return existing.id;
  const { user } = await auth.api.signUpEmail({ body: { name, email, password } });
  return user.id;
}

// Idempotent: creates each login and staff row only when missing.
export async function seedOfficeRoles(password: string) {
  for (const p of PEOPLE) {
    const [c] = await db.select({ id: t.campus.id }).from(t.campus).where(eq(t.campus.code, p.campus));
    for (const role of ["admissions", "exams", "accounts", "hr"] as const) {
      const name = p.names[role];
      const userId = await login(name, `${p.prefix}.${role}@termwise.demo`, password);
      const [have] = await db.select({ id: t.staff.id }).from(t.staff).where(and(eq(t.staff.userId, userId), eq(t.staff.campusId, c.id)));
      if (!have) await db.insert(t.staff).values({ userId, campusId: c.id, departmentId: null, name, role });
    }
  }
}
