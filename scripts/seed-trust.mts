import { eq, like } from "drizzle-orm";
import { auth } from "../src/server/auth";
import { db } from "../src/server/db";
import * as t from "../src/server/schema";
import { istDate } from "../src/domain/attendance";

const TRUST_EMAIL = "trust@termwise.demo";
const MBA_BATCH = "MBA-2025";
const MBA_TARGET = 20;
const FIRST = ["Aarav", "Anil", "Chinmay", "Ipsita", "Kajal", "Lipsa", "Manas", "Monalisa", "Nihar", "Pallavi", "Rashmi", "Sagar", "Sasmita", "Satya", "Smruti", "Tapas"];
const LAST = ["Behera", "Biswal", "Dash", "Jena", "Mohapatra", "Nayak", "Pradhan", "Rath", "Rout", "Sahoo", "Samal", "Sethi", "Swain", "Tripathy"];

// Fixed seed so the top-up produces the same students every time.
let seed = 20260;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = <A,>(xs: A[]) => xs[Math.floor(rnd() * xs.length)];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

// Idempotent backfill: the trust login and a fuller MBA intake. Re-running changes nothing once in place.
export async function seedTrust(password: string) {
  await seedTrustLogin(password);
  await topUpMba();
}

async function seedTrustLogin(password: string) {
  const [existing] = await db.select({ id: t.user.id }).from(t.user).where(eq(t.user.email, TRUST_EMAIL));
  if (existing) return;
  const [eng] = await db.select({ id: t.campus.id }).from(t.campus).where(eq(t.campus.code, "ENG"));
  const name = "Bijay Mishra";
  const { user } = await auth.api.signUpEmail({ body: { name, email: TRUST_EMAIL, password } });
  await db.insert(t.staff).values({ userId: user.id, campusId: eng.id, departmentId: null, name, role: "trust" });
}

async function topUpMba() {
  const [batch] = await db.select({ id: t.batch.id }).from(t.batch).where(eq(t.batch.code, MBA_BATCH));
  const have = await db.select({ id: t.student.id }).from(t.student).where(eq(t.student.batchId, batch.id));
  if (have.length >= MBA_TARGET) return;

  const taken = new Set((await db.select({ rollNo: t.student.rollNo }).from(t.student).where(like(t.student.rollNo, "MBA-25-%"))).map((r) => r.rollNo));
  const rolls: string[] = [];
  for (let n = 1; rolls.length < MBA_TARGET - have.length; n++) {
    const roll = `MBA-25-${String(n).padStart(4, "0")}`;
    if (!taken.has(roll)) rolls.push(roll);
  }
  const dob = (year: number) => `${year}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}`;
  const students = await db.insert(t.student).values(rolls.map((rollNo) => {
    const last = pick(LAST);
    return { rollNo, name: `${pick(FIRST)} ${last}`, batchId: batch.id, birthDate: dob(2001 + Math.floor(rnd() * 4)), guardianName: `${pick(FIRST)} ${last}`, guardianPhone: `+91 90000 ${rollNo.slice(-5)}` };
  })).returning();

  const today = new Date(istDate() + "T00:00:00Z");
  for (const st of students) {
    const [a, b] = await db.insert(t.feeInstalment).values([
      { studentId: st.id, label: "Instalment 1", dueDate: iso(addDays(today, -60)), amountPaise: 6000000 },
      { studentId: st.id, label: "Instalment 2", dueDate: iso(addDays(today, -7)), amountPaise: 6000000 },
    ]).returning();
    await db.insert(t.feePayment).values([
      { instalmentId: a.id, amountPaise: a.amountPaise, mode: "bank_counter", reference: `BANK-${st.id}-1`, paidAt: addDays(today, -58) },
      ...(rnd() < 0.7 ? [{ instalmentId: b.id, amountPaise: b.amountPaise, mode: "bank_counter" as const, reference: `BANK-${st.id}-2`, paidAt: addDays(today, -6) }] : []),
    ]);
  }

  // Every existing MBA session gets an entry for each new student.
  const sessions = await db.select({ id: t.attendanceSession.id }).from(t.attendanceSession).where(eq(t.attendanceSession.batchId, batch.id));
  const entries: (typeof t.attendanceEntry.$inferInsert)[] = [];
  for (const st of students) {
    for (const s of sessions) {
      const r = rnd();
      entries.push({ sessionId: s.id, studentId: st.id, status: r < 0.1 ? "absent" : r < 0.14 ? "late" : "present" });
    }
  }
  for (let i = 0; i < entries.length; i += 5000) await db.insert(t.attendanceEntry).values(entries.slice(i, i + 5000));
}
