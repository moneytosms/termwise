import { and, eq, isNull } from "drizzle-orm";
import { db } from "../src/server/db";
import * as t from "../src/server/schema";

// Idempotent backfill for fees and categories. Students and applicants without a gender get one (and students a category), and programmes with a default fee but no category fees get SC and ST fees at half the default. Existing rows are never overwritten.
const GENERAL_ROLLS = ["ENG-24-CSE-0412", "ENG-24-ME-0177", "MBA-25-0093"];

const genderFor = (id: number) => (id % 2 ? "female" : "male");
function categoryFor(id: number) {
  const d = id % 10;
  if (d <= 4) return "general";
  if (d <= 6) return "obc";
  if (d === 7) return "sc";
  if (d === 8) return "st";
  return "ews";
}

export async function seedFees(password: string) {
  void password;
  const students = await db.select({ id: t.student.id, rollNo: t.student.rollNo }).from(t.student).where(isNull(t.student.gender));
  for (const s of students) {
    await db.update(t.student).set({
      gender: genderFor(s.id) as "male" | "female",
      category: GENERAL_ROLLS.includes(s.rollNo) ? "general" : categoryFor(s.id),
    }).where(and(eq(t.student.id, s.id), isNull(t.student.gender)));
  }

  const applicants = await db.select({ id: t.applicant.id }).from(t.applicant).where(isNull(t.applicant.gender));
  for (const a of applicants) {
    await db.update(t.applicant).set({ gender: genderFor(a.id) as "male" | "female" })
      .where(and(eq(t.applicant.id, a.id), isNull(t.applicant.gender)));
  }

  const programmes = await db.select({ id: t.programme.id, semesterFeePaise: t.programme.semesterFeePaise }).from(t.programme);
  const withRows = new Set((await db.select({ programmeId: t.feeStructure.programmeId }).from(t.feeStructure)).map((r) => r.programmeId));
  for (const p of programmes) {
    if (p.semesterFeePaise <= 0 || withRows.has(p.id)) continue;
    const half = Math.round(p.semesterFeePaise / 2);
    await db.insert(t.feeStructure).values([
      { programmeId: p.id, category: "sc", semesterFeePaise: half },
      { programmeId: p.id, category: "st", semesterFeePaise: half },
    ]).onConflictDoNothing();
  }
}
