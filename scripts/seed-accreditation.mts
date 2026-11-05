import { and, eq } from "drizzle-orm";
import { db } from "../src/server/db";
import * as t from "../src/server/schema";

// Idempotent backfill for accreditation. Demo programmes get their sanctioned intake while still at the default, and faculty with no designation or qualification get one by id.
const INTAKE: Record<string, number> = { CSE: 120, ME: 60, MBA: 60, BPH: 60 };
type Designation = "professor" | "associate_professor" | "assistant_professor";

const designationFor = (id: number): Designation => (id % 9 === 0 ? "professor" : id % 9 <= 2 ? "associate_professor" : "assistant_professor");
function qualificationFor(id: number, campusCode: string): string {
  if (campusCode === "MGT") return id % 3 === 0 ? "Ph.D." : "MBA";
  if (id % 3 === 0) return "Ph.D.";
  if (id % 3 === 1) return "M.Tech";
  return campusCode === "PHR" ? "M.Pharm" : "M.E.";
}

// Sanctioned teaching posts per demo department, set only while the value is still the default 0.
const SANCTIONED_POSTS: Record<string, number> = { "Computer Science": 30, Mechanical: 20, Management: 15, "Pharmaceutical Sciences": 15 };

export async function seedAccreditation(password: string) {
  void password;
  for (const [name, posts] of Object.entries(SANCTIONED_POSTS)) {
    await db.update(t.department).set({ sanctionedPosts: posts })
      .where(and(eq(t.department.name, name), eq(t.department.sanctionedPosts, 0)));
  }
  for (const [code, sanctioned] of Object.entries(INTAKE)) {
    await db.update(t.programme).set({ sanctionedIntake: sanctioned })
      .where(and(eq(t.programme.code, code), eq(t.programme.sanctionedIntake, 60)));
  }

  const campuses = await db.select({ id: t.campus.id, code: t.campus.code }).from(t.campus);
  for (const c of campuses) {
    const faculty = await db.select({ id: t.staff.id, designation: t.staff.designation, qualification: t.staff.qualification }).from(t.staff)
      .where(and(eq(t.staff.campusId, c.id), eq(t.staff.role, "faculty")));
    for (const s of faculty) {
      const patch: { designation?: Designation; qualification?: string } = {};
      if (s.designation === null) patch.designation = designationFor(s.id);
      if (s.qualification === null) patch.qualification = qualificationFor(s.id, c.code);
      if (Object.keys(patch).length) await db.update(t.staff).set(patch).where(eq(t.staff.id, s.id));
    }
  }
}
