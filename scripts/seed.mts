import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { auth } from "../src/server/auth";
import { db, pool } from "../src/server/db";
import * as t from "../src/server/schema";
import { istDate } from "../src/domain/attendance";
import { runDailyJob } from "../src/server/jobs/daily";

// Synthetic data only. Re-run on an empty database; skipped if campuses already exist.
const [{ n }] = await db.select({ n: count() }).from(t.campus);
if (n > 0) { console.log("already seeded"); await pool.end(); process.exit(0); }

let seed = 42;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = <A,>(xs: A[]) => xs[Math.floor(rnd() * xs.length)];
const PASSWORD = "termwise-demo";

const FIRST = ["Aarav", "Aditi", "Amrita", "Anil", "Arpita", "Bikash", "Chinmay", "Debasish", "Deepika", "Gyana", "Ipsita", "Jyoti", "Kajal", "Lipsa", "Manas", "Monalisa", "Nihar", "Pallavi", "Pradeep", "Priya", "Rakesh", "Rashmi", "Rohan", "Sagar", "Sasmita", "Satya", "Smruti", "Soumya", "Sushant", "Tapas"];
const LAST = ["Behera", "Biswal", "Das", "Dash", "Jena", "Mishra", "Mohapatra", "Nayak", "Panda", "Patnaik", "Pradhan", "Rath", "Rout", "Sahoo", "Samal", "Sethi", "Swain", "Tripathy"];
const personName = () => `${pick(FIRST)} ${pick(LAST)}`;

async function person(campusId: number, departmentId: number | null, name: string, email: string, role: "faculty" | "office_admin") {
  const { user } = await auth.api.signUpEmail({ body: { name, email, password: PASSWORD } });
  const [s] = await db.insert(t.staff).values({ userId: user.id, campusId, departmentId, name, role }).returning();
  return s;
}

const [eng, mgmt] = await db.insert(t.campus).values([
  { code: "ENG", name: "Engineering College" },
  { code: "MGT", name: "Management School" },
]).returning();
const [cseDept, meDept] = await db.insert(t.department).values([
  { campusId: eng.id, name: "Computer Science" }, { campusId: eng.id, name: "Mechanical" },
]).returning();
const [mbaDept] = await db.insert(t.department).values([{ campusId: mgmt.id, name: "Management" }]).returning();

const admin = await person(eng.id, null, "Sunita Rath", "admin@termwise.demo", "office_admin");
const faculty = await person(eng.id, cseDept.id, "Bibhu Prasad Sahoo", "faculty@termwise.demo", "faculty");
const faculty2 = await person(eng.id, cseDept.id, "Madhusmita Nayak", "faculty2@termwise.demo", "faculty");
const meFaculty = await person(eng.id, meDept.id, "Ranjan Kumar Jena", "me.faculty@termwise.demo", "faculty");
const mbaAdmin = await person(mgmt.id, null, "Lopamudra Das", "mba.admin@termwise.demo", "office_admin");
const mbaFaculty = await person(mgmt.id, mbaDept.id, "Sandeep Mishra", "mba.faculty@termwise.demo", "faculty");
void admin; void mbaAdmin;

const [cse, me] = await db.insert(t.programme).values([
  { campusId: eng.id, departmentId: cseDept.id, code: "CSE", name: "B.Tech CSE" },
  { campusId: eng.id, departmentId: meDept.id, code: "ME", name: "B.Tech Mechanical" },
]).returning();
const [mba] = await db.insert(t.programme).values([{ campusId: mgmt.id, departmentId: mbaDept.id, code: "MBA", name: "MBA" }]).returning();
const [cseB, meB, mbaB] = await db.insert(t.batch).values([
  { programmeId: cse.id, code: "CSE-2024", admissionYear: 2024, year: 2, semester: 3 },
  { programmeId: me.id, code: "ME-2024", admissionYear: 2024, year: 2, semester: 3 },
  { programmeId: mba.id, code: "MBA-2025", admissionYear: 2025, year: 1, semester: 1 },
]).returning();

async function subjects(batchId: number, rows: [string, string, number][]) {
  return db.insert(t.subject).values(rows.map(([code, name, facultyId]) => ({ batchId, code, name, facultyId }))).returning();
}
const cseSubs = await subjects(cseB.id, [
  ["CS301", "Data Structures", faculty.id], ["CS302", "Database Systems", faculty.id], ["CS303", "Operating Systems", faculty2.id],
  ["CS304", "Discrete Mathematics", faculty2.id], ["CS305", "Computer Organisation", faculty.id], ["CS306", "Data Structures Lab", faculty.id],
]);
const meSubs = await subjects(meB.id, [["ME301", "Thermodynamics", meFaculty.id], ["ME302", "Strength of Materials", meFaculty.id]]);
const mbaSubs = await subjects(mbaB.id, [["MB101", "Managerial Economics", mbaFaculty.id], ["MB102", "Financial Accounting", mbaFaculty.id]]);

// 9-period grid. Sunday carries an extra class so the demo always has a class to mark.
const PERIODS: [string, string][] = [["09:00", "09:50"], ["09:50", "10:40"], ["10:50", "11:40"], ["11:40", "12:30"], ["13:15", "14:05"], ["14:05", "14:55"], ["15:05", "15:55"], ["15:55", "16:45"], ["16:45", "17:35"]];
async function grid(batchId: number, subs: typeof cseSubs) {
  const theory = subs.filter((s) => !s.name.endsWith("Lab"));
  const lab = subs.find((s) => s.name.endsWith("Lab"));
  const rows: (typeof t.timetableSlot.$inferInsert)[] = [];
  for (let day = 0; day <= 6; day++) {
    for (let p = 0; p < 9; p++) {
      if (lab && day === 3 && p === 4) {
        rows.push({ batchId, dayOfWeek: day, period: 5, periodCount: 3, startTime: PERIODS[4][0], endTime: PERIODS[6][1], subjectId: lab.id });
        p = 6;
        continue;
      }
      if (day === 5 && p === 8) { rows.push({ batchId, dayOfWeek: day, period: 9, startTime: PERIODS[8][0], endTime: PERIODS[8][1], label: "Club activity" }); continue; }
      if (p === 7 && day === 2) { rows.push({ batchId, dayOfWeek: day, period: 8, startTime: PERIODS[7][0], endTime: PERIODS[7][1], label: "Sports" }); continue; }
      rows.push({ batchId, dayOfWeek: day, period: p + 1, startTime: PERIODS[p][0], endTime: PERIODS[p][1], subjectId: theory[(day * 2 + p) % theory.length].id });
    }
  }
  return db.insert(t.timetableSlot).values(rows).returning();
}
const cseSlots = await grid(cseB.id, cseSubs);
const meSlots = await grid(meB.id, meSubs);
const mbaSlots = await grid(mbaB.id, mbaSubs);

const today = new Date(istDate() + "T00:00:00Z");
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
await db.insert(t.calendarDay).values([
  { campusId: eng.id, date: iso(addDays(today, 12)), kind: "exam", label: "Mid-term exams begin" },
  { campusId: eng.id, date: iso(addDays(today, 25)), kind: "holiday", label: "Institute holiday" },
]);

// Students: the brief's three keep their exact figures.
function dob(year: number) { return `${year}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}`; }
const cseStudents = await db.insert(t.student).values([
  { rollNo: "ENG-24-CSE-0412", name: "Subhashree Mohanty", batchId: cseB.id, mentorId: faculty.id, birthDate: "2006-03-14", guardianName: "Prakash Mohanty", guardianPhone: "+91 90000 00412" },
  ...Array.from({ length: 119 }, (_, i) => {
    const num = String(i < 411 ? i + 1 : i + 2).padStart(4, "0");
    return {
      rollNo: `ENG-24-CSE-${num}`, name: personName(), batchId: cseB.id, mentorId: i % 2 ? faculty.id : faculty2.id,
      birthDate: dob(2006), guardianName: personName(), guardianPhone: `+91 90000 0${num}`,
    };
  }),
]).returning();
const meStudents = await db.insert(t.student).values([
  { rollNo: "ENG-24-ME-0177", name: "Ankit Panda", batchId: meB.id, mentorId: meFaculty.id, birthDate: "2006-07-02", guardianName: "Sarat Panda", guardianPhone: "+91 90000 00177" },
  ...Array.from({ length: 9 }, (_, i) => ({ rollNo: `ENG-24-ME-${String(i + 1).padStart(4, "0")}`, name: personName(), batchId: meB.id, mentorId: meFaculty.id, birthDate: dob(2006), guardianName: personName(), guardianPhone: `+91 90000 1000${i}` })),
]).returning();
const mbaStudents = await db.insert(t.student).values([
  { rollNo: "MBA-25-0093", name: "Farheen Ali", batchId: mbaB.id, mentorId: mbaFaculty.id, birthDate: "2003-11-21", guardianName: "Imran Ali", guardianPhone: "+91 90000 00093" },
]).returning();

/**
 * Walks back from yesterday until exactly `targetPeriods` are held. Each student's absences are
 * spread over those periods; `exact` pins a student's overall percent so seeded figures match the brief.
 */
async function history(slots: typeof cseSlots, batchId: number, subs: typeof cseSubs, students: typeof cseStudents, targetPeriods: number, exact: Map<number, number>) {
  const sessions: (typeof t.attendanceSession.$inferInsert)[] = [];
  let held = 0;
  for (let back = 1; held < targetPeriods; back++) {
    const d = addDays(today, -back);
    for (const s of slots.filter((x) => x.dayOfWeek === d.getUTCDay() && x.subjectId).sort((a, b) => a.period - b.period)) {
      if (held + s.periodCount > targetPeriods) continue;
      held += s.periodCount;
      const sub = subs.find((x) => x.id === s.subjectId)!;
      sessions.push({ id: randomUUID(), batchId, subjectId: sub.id, date: iso(d), period: s.period, periodCount: s.periodCount, facultyId: sub.facultyId!, editedAt: new Date(iso(d) + "T06:00:00Z"), syncedAt: new Date(iso(d) + "T06:01:00Z") });
    }
  }
  await db.insert(t.attendanceSession).values(sessions);

  const bySubject = Map.groupBy(sessions.map((x, i) => ({ x, i })), ({ x }) => x.subjectId);
  const share = (i: number) => { const list = bySubject.get(sessions[i].subjectId)!; return (list.findIndex((e) => e.i === i) + 0.5) / list.length; };
  const entries: (typeof t.attendanceEntry.$inferInsert)[] = [];
  for (const [si, st] of students.entries()) {
    const typical = si % 12 === 0 ? 0.32 : si % 7 === 0 ? 0.14 : 0.07; // a realistic share fall short
    let absentLeft = Math.round(targetPeriods * (exact.has(st.id) ? (100 - exact.get(st.id)!) / 100 : typical));
    // Pinned students get absences spread evenly across subjects, so no subject dips far from their overall figure.
    const order = exact.has(st.id) ? sessions.map((_, i) => i).sort((a, b) => share(a) - share(b)) : sessions.map((_, i) => i).sort(() => rnd() - 0.5);
    const status = new Map<number, "present" | "absent" | "late">();
    for (const i of order) {
      if (absentLeft >= sessions[i].periodCount!) { status.set(i, "absent"); absentLeft -= sessions[i].periodCount!; }
    }
    sessions.forEach((sess, i) => entries.push({ sessionId: sess.id, studentId: st.id, status: status.get(i) ?? (rnd() < 0.04 ? "late" : "present") }));
  }
  for (let i = 0; i < entries.length; i += 5000) await db.insert(t.attendanceEntry).values(entries.slice(i, i + 5000));
}
await history(cseSlots, cseB.id, cseSubs, cseStudents, 200, new Map([[cseStudents[0].id, 81.5]]));
await history(meSlots, meB.id, meSubs, meStudents, 220, new Map([[meStudents[0].id, 68.2]]));
await history(mbaSlots, mbaB.id, mbaSubs, mbaStudents, 200, new Map([[mbaStudents[0].id, 92]]));

// Marks: Mid-term 20, Assignment 10, Quiz 5, Attendance 5.
const SPLIT = (total: number): number[] => {
  const mid = Math.round(total / 2);
  const asg = Math.round(total / 4);
  const att = Math.min(5, Math.round((total - mid - asg) / 2));
  return [mid, asg, total - mid - asg - att, att];
};
async function marks(subs: typeof cseSubs, students: typeof cseStudents, pinned: Map<number, number>, statuses: ("draft" | "submitted" | "locked")[]) {
  for (const [i, sub] of subs.entries()) {
    const comps = await db.insert(t.markComponent).values(
      ([["Mid-term", 20], ["Assignment", 10], ["Quiz", 5], ["Attendance", 5]] as const).map(([name, maxMarks], position) => ({ subjectId: sub.id, name, maxMarks, position })),
    ).returning();
    const status = statuses[i] ?? "draft";
    if (status !== "draft") await db.update(t.subject).set({ marksStatus: status }).where(eqId(sub.id));
    const rows: (typeof t.mark.$inferInsert)[] = [];
    for (const [si, st] of students.entries()) {
      const total = pinned.get(st.id) ?? (si % 17 === 0 ? 14 + Math.floor(rnd() * 5) : 20 + Math.floor(rnd() * 17));
      const split = SPLIT(total);
      comps.forEach((c, ci) => {
        // A draft subject has its last two components still to enter.
        rows.push({ componentId: c.id, studentId: st.id, marks: status === "draft" && ci >= 2 && i % 2 === 0 ? null : Math.min(split[ci], c.maxMarks) });
      });
    }
    await db.insert(t.mark).values(rows);
  }
}
const eqId = (id: number) => eq(t.subject.id, id);
await marks(cseSubs, cseStudents, new Map([[cseStudents[0].id, 33]]), ["draft", "submitted", "locked", "submitted", "draft", "draft"]);
await marks(meSubs, meStudents, new Map([[meStudents[0].id, 21]]), ["submitted", "submitted"]);
await marks(mbaSubs, mbaStudents, new Map([[mbaStudents[0].id, 36]]), ["submitted", "submitted"]);

// Fees: two instalments; the brief's dues are exact.
async function fees(students: typeof cseStudents, pinnedDue: Map<number, number>, semesterFee: number) {
  for (const [si, st] of students.entries()) {
    const half = semesterFee / 2 * 100;
    const [a, b] = await db.insert(t.feeInstalment).values([
      { studentId: st.id, label: "Instalment 1", dueDate: iso(addDays(today, -60)), amountPaise: half, scholarshipPaise: si % 10 === 3 ? 10000_00 : 0 },
      { studentId: st.id, label: "Instalment 2", dueDate: iso(addDays(today, -7)), amountPaise: half },
    ]).returning();
    const due = pinnedDue.has(st.id) ? pinnedDue.get(st.id)! * 100 : si % 6 === 1 ? half : si % 15 === 2 ? half / 2 : 0;
    const payA = a.amountPaise - a.scholarshipPaise;
    const payB = Math.max(0, b.amountPaise - due);
    await db.insert(t.feePayment).values([
      { instalmentId: a.id, amountPaise: payA, mode: "bank_counter", reference: `BANK-${st.id}-1`, paidAt: addDays(today, -58) },
      ...(payB > 0 ? [{ instalmentId: b.id, amountPaise: payB, mode: "bank_counter" as const, reference: `BANK-${st.id}-2`, paidAt: addDays(today, -6) }] : []),
    ]);
  }
}
await fees(cseStudents, new Map([[cseStudents[0].id, 0]]), 90000);
await fees(meStudents, new Map([[meStudents[0].id, 45000]]), 90000);
await fees(mbaStudents, new Map([[mbaStudents[0].id, 0]]), 120000);

// One open conflict so the queue isn't empty in the demo: a second teacher's sheet for a session already saved.
const [someSession] = await db.select().from(t.attendanceSession).where(eq(t.attendanceSession.subjectId, cseSubs[0].id)).limit(1);
const someEntries = await db.select().from(t.attendanceEntry).where(eq(t.attendanceEntry.sessionId, someSession.id));
await db.insert(t.syncConflict).values({
  sessionId: someSession.id, kind: "different_teacher", facultyId: faculty2.id,
  payload: {
    sessionId: randomUUID(), batchId: someSession.batchId, subjectId: someSession.subjectId, date: someSession.date, period: someSession.period, periodCount: someSession.periodCount,
    entries: someEntries.map((e, i) => ({ studentId: e.studentId, status: i % 7 === 0 ? "absent" : "present" })),
    editedAt: new Date(someSession.date + "T07:00:00Z").toISOString(),
  },
});

// Rule-based reasons only at seed time, so a fresh demo has flags, mentor tasks and messages.
delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
delete process.env.GROQ_API_KEY;
for (const c of [eng, mgmt]) console.log(c.code, await runDailyJob(c.id, "schedule"));

await pool.end();
console.log("seeded");
