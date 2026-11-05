import { randomUUID } from "node:crypto";
import { count, eq, inArray, isNotNull } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/server/db";
import * as t from "../src/server/schema";
import { istDate } from "../src/domain/attendance";

const DOCS = ["Class 10 marksheet", "Class 12 marksheet", "Transfer certificate", "Migration certificate", "Aadhaar card", "Passport photo"];
// Ankit's family comes first so the demo buttons get the plain addresses.
export const DEMO_STUDENT = "ankit.panda@termwise.demo";
export const DEMO_PARENT = "sarat.panda@termwise.demo";

/**
 * A login for every student and every guardian (firstname.lastname@termwise.demo, numbered on a clash),
 * document checklists and sample leave. Skipped once any student has a login.
 * Sibling pairs share one guardian: Ankit with his younger sister Riya (a minor), and four CSE/ME pairs.
 */
export async function seedPortal(password: string) {
  const [{ n }] = await db.select({ n: count() }).from(t.student).where(isNotNull(t.student.userId));
  if (n > 0) return;

  const byRoll = async (rollNo: string) => (await db.select().from(t.student).where(eq(t.student.rollNo, rollNo)))[0];
  const ankit = await byRoll("ENG-24-ME-0177");
  const surname = (name: string) => name.split(" ").at(-1)!;
  const sibling = async (older: typeof ankit, rollNo: string, birthDate?: string) => {
    const s = await byRoll(rollNo);
    if (!older || !s) return;
    await db.update(t.student).set({
      name: `${s.name.split(" ")[0]} ${surname(older.name)}`, guardianName: older.guardianName, guardianPhone: older.guardianPhone,
      ...(birthDate ? { birthDate, parentConsentAt: null } : {}),
    }).where(eq(t.student.id, s.id));
  };
  await sibling(ankit, "ENG-24-CSE-0012", "2009-02-11");
  if (ankit) await db.update(t.student).set({ name: "Riya Panda" }).where(eq(t.student.rollNo, "ENG-24-CSE-0012"));
  for (const k of [1, 2, 3, 4]) await sibling(await byRoll(`ENG-24-CSE-${String(k * 20).padStart(4, "0")}`), `ENG-24-ME-${String(k).padStart(4, "0")}`);

  const students = await db.select().from(t.student).orderBy(t.student.id);
  students.sort((a, b) => Number(b.id === ankit?.id) - Number(a.id === ankit?.id));
  const taken = new Set((await db.select({ email: t.user.email }).from(t.user)).map((u) => u.email));
  const emailFor = (name: string) => {
    const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z ]/g, "").trim().split(/\s+/).join(".");
    let email = `${base}@termwise.demo`;
    for (let i = 2; taken.has(email); i++) email = `${base}${i}@termwise.demo`;
    taken.add(email);
    return email;
  };

  // One hash for everyone: same demo password, and signing up hundreds of users one by one is slow.
  const hash = await hashPassword(password);
  const users: (typeof t.user.$inferInsert)[] = [];
  const studentUser = new Map<number, string>();
  const guardians = new Map<string, { userId: string; name: string; phone: string | null; children: number[] }>();
  for (const s of students) {
    const id = randomUUID();
    users.push({ id, name: s.name, email: emailFor(s.name) });
    studentUser.set(s.id, id);
    const key = `${s.guardianName}|${s.guardianPhone}`;
    if (!s.guardianName) continue;
    const g = guardians.get(key);
    if (g) { g.children.push(s.id); continue; }
    const gid = randomUUID();
    users.push({ id: gid, name: s.guardianName, email: emailFor(s.guardianName) });
    guardians.set(key, { userId: gid, name: s.guardianName, phone: s.guardianPhone, children: [s.id] });
  }
  await db.transaction(async (tx) => {
    await tx.insert(t.user).values(users);
    await tx.insert(t.account).values(users.map((u) => ({ id: randomUUID(), accountId: u.id, providerId: "credential", userId: u.id, password: hash })));
    for (const [sid, uid] of studentUser) await tx.update(t.student).set({ userId: uid }).where(eq(t.student.id, sid));
    const rows = await tx.insert(t.guardian).values([...guardians.values()].map(({ userId, name, phone }) => ({ userId, name, phone }))).returning();
    const byUser = new Map(rows.map((r) => [r.userId, r.id]));
    await tx.insert(t.guardianStudent).values([...guardians.values()].flatMap((g) => g.children.map((studentId) => {
      const female = students.find((s) => s.id === studentId)!.guardianName!.split(" ")[0];
      return { guardianId: byUser.get(g.userId)!, studentId, relation: FEMALE.has(female) ? "Mother" : "Father" };
    })));
  });

  const have = new Set((await db.selectDistinct({ id: t.studentDocument.studentId }).from(t.studentDocument)
    .where(inArray(t.studentDocument.studentId, students.map((s) => s.id)))).map((r) => r.id));
  const docs = students.filter((s) => !have.has(s.id)).flatMap((s, si) => DOCS.map((name, i) => ({
    studentId: s.id, name,
    status: (si % 9 === 4 && i >= 3 ? "pending" : si % 9 === 4 && i === 2 ? "received" : s.id === ankit?.id && i === 3 ? "pending" : "verified") as "pending" | "received" | "verified",
  })));
  for (let i = 0; i < docs.length; i += 2000) await db.insert(t.studentDocument).values(docs.slice(i, i + 2000));

  if (!ankit) return;
  const day = (n: number) => new Date(Date.parse(istDate() + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
  await db.insert(t.leaveRequest).values([
    { studentId: ankit.id, kind: "medical", fromDate: day(-20), toDate: day(-19), reason: "Viral fever, doctor's note attached at the office.", status: "approved", parentNote: "Approved.", mentorNote: "Get well soon.", decidedAt: new Date(day(-18)) },
    { studentId: ankit.id, kind: "leave", fromDate: day(3), toDate: day(4), reason: "Cousin's wedding in Cuttack.", status: "pending_parent" },
  ]);
}

// Female first names in the seed's name list, for the guardian's relation.
const FEMALE = new Set(["Aditi", "Amrita", "Arpita", "Deepika", "Ipsita", "Jyoti", "Kajal", "Lipsa", "Monalisa", "Pallavi", "Priya", "Rashmi", "Sasmita", "Smruti"]);
