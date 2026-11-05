import { eq, inArray } from "drizzle-orm";
import { istDate, istDayOfWeek } from "../src/domain/attendance";
import { shiftDays } from "../src/domain/staff-leave";
import { db } from "../src/server/db";
import * as t from "../src/server/schema";

// Idempotent backfill: a few staff leave requests in each state, around the current IST week. Skipped once any exists.
export async function seedStaffLeave() {
  const [any] = await db.select({ id: t.staffLeave.id }).from(t.staffLeave).limit(1);
  if (any) return;

  const emails = ["cse.faculty@termwise.demo", "cse.faculty2@termwise.demo", "me.faculty@termwise.demo", "eng.admin@termwise.demo"];
  const people = await db.select({ id: t.staff.id, email: t.user.email }).from(t.staff)
    .innerJoin(t.user, eq(t.staff.userId, t.user.id))
    .where(inArray(t.user.email, emails));
  const id = (email: string) => people.find((p) => p.email === email)?.id;
  const faculty = id("cse.faculty@termwise.demo");
  const faculty2 = id("cse.faculty2@termwise.demo");
  const meFaculty = id("me.faculty@termwise.demo");
  const admin = id("eng.admin@termwise.demo");
  if (!faculty || !faculty2 || !meFaculty || !admin) {
    console.log("staff leave: demo staff not found, skipped");
    return;
  }

  // Monday of this IST week, and the first of next month.
  const today = istDate();
  const monday = shiftDays(today, -((istDayOfWeek() + 6) % 7));
  const [y, m] = today.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const at = (base: string, n: number) => shiftDays(base, n);
  const decidedAt = new Date();

  const rows: (typeof t.staffLeave.$inferInsert)[] = [
    // Faculty: approved this week (Wed–Thu), so the Classes week shows On leave.
    { staffId: faculty, kind: "casual", fromDate: at(monday, 2), toDate: at(monday, 3), reason: "Family wedding in the village.", status: "approved", note: "Covered by the Thursday substitute.", decidedById: admin, decidedAt },
    // Faculty: rejected medical with a note, last fortnight.
    { staffId: faculty, kind: "medical", fromDate: at(monday, -14), toDate: at(monday, -13), reason: "Fever and cough.", status: "rejected", note: "Please attach the doctor's certificate and apply again.", decidedById: admin, decidedAt },
    // Faculty: withdrawn by the applicant.
    { staffId: faculty, kind: "casual", fromDate: at(monday, 7), toDate: at(monday, 8), reason: "Personal work, no longer needed.", status: "withdrawn" },
    // Second faculty: pending casual next month, and approved on duty last week.
    { staffId: faculty2, kind: "casual", fromDate: at(nextMonth, 1), toDate: at(nextMonth, 3), reason: "Visit to the board office in Bhubaneswar.", status: "pending" },
    { staffId: faculty2, kind: "on_duty", fromDate: at(monday, -7), toDate: at(monday, -6), reason: "Invigilation at the university exam centre.", status: "approved", note: "Approved.", decidedById: admin, decidedAt },
    // Another faculty: pending medical, for the office queue.
    { staffId: meFaculty, kind: "medical", fromDate: at(monday, 10), toDate: at(monday, 11), reason: "Dental procedure, needs the morning off.", status: "pending" },
  ];
  await db.insert(t.staffLeave).values(rows);
}
