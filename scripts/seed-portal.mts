import { eq } from "drizzle-orm";
import { auth } from "../src/server/auth";
import { db } from "../src/server/db";
import * as t from "../src/server/schema";
import { istDate } from "../src/domain/attendance";

const DOCS = ["Class 10 marksheet", "Class 12 marksheet", "Transfer certificate", "Migration certificate", "Aadhaar card", "Passport photo"];

/**
 * Student and parent demo logins, documents and sample leave. Safe on a database seeded before the portal
 * existed: skipped once student@termwise.demo exists. Ankit (the brief's at-risk student) signs in as the
 * student; his father signs in as the parent of Ankit and a younger sister who is a minor.
 */
export async function seedPortal(password: string) {
  const [done] = await db.select({ id: t.user.id }).from(t.user).where(eq(t.user.email, "student@termwise.demo"));
  if (done) return;
  const byRoll = async (rollNo: string) => (await db.select().from(t.student).where(eq(t.student.rollNo, rollNo)))[0];
  const ankit = await byRoll("ENG-24-ME-0177");
  const riya = await byRoll("ENG-24-CSE-0012");
  if (!ankit || !riya) return;

  await db.update(t.student).set({ name: "Riya Panda", birthDate: "2009-02-11", guardianName: ankit.guardianName, guardianPhone: ankit.guardianPhone, parentConsentAt: null })
    .where(eq(t.student.id, riya.id));
  const { user: su } = await auth.api.signUpEmail({ body: { name: ankit.name, email: "student@termwise.demo", password } });
  await db.update(t.student).set({ userId: su.id }).where(eq(t.student.id, ankit.id));
  const { user: pu } = await auth.api.signUpEmail({ body: { name: ankit.guardianName ?? "Sarat Panda", email: "parent@termwise.demo", password } });
  const [g] = await db.insert(t.guardian).values({ userId: pu.id, name: ankit.guardianName ?? "Sarat Panda", phone: ankit.guardianPhone }).returning();
  await db.insert(t.guardianStudent).values([
    { guardianId: g.id, studentId: ankit.id, relation: "Father" },
    { guardianId: g.id, studentId: riya.id, relation: "Father" },
  ]);

  const students = await db.select({ id: t.student.id }).from(t.student);
  const docs = students.flatMap((s) => DOCS.map((name, i) => ({
    studentId: s.id, name,
    status: (s.id === ankit.id && i === 3 ? "pending" : s.id === ankit.id && i === 2 ? "received" : "verified") as "pending" | "received" | "verified",
  })));
  for (let i = 0; i < docs.length; i += 2000) await db.insert(t.studentDocument).values(docs.slice(i, i + 2000));

  const day = (n: number) => new Date(Date.parse(istDate() + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
  await db.insert(t.leaveRequest).values([
    { studentId: ankit.id, kind: "medical", fromDate: day(-20), toDate: day(-19), reason: "Viral fever, doctor's note attached at the office.", status: "approved", parentNote: "Approved.", mentorNote: "Get well soon.", decidedAt: new Date(day(-18)) },
    { studentId: ankit.id, kind: "leave", fromDate: day(3), toDate: day(4), reason: "Cousin's wedding in Cuttack.", status: "pending_parent" },
  ]);
}
