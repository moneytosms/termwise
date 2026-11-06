import { and, eq, like } from "drizzle-orm";
import { db } from "../src/server/db";
import * as t from "../src/server/schema";

// Idempotent backfill for alumni. Three finished batches (students graduated, graduatedOn set) and a CSE-2021 batch in its last semester, all subjects locked, whose three students are still enrolled so the graduate flow can be run. A batch whose code already exists is never touched.
const NAMES = ["Asha Nayak", "Biswajit Rout", "Chandni Sahu", "Debasish Patra", "Elina Mishra", "Gourab Das", "Hemlata Pradhan", "Ishan Tripathy"];
const BIRTH = "2002-08-15";

async function addBatch(opts: {
  campus: string; programme: string; code: string; admissionYear: number; year: number; semester: number;
  rolls: string[]; graduatedOn: string | null; subjects: [string, string][]; gender?: "male" | "female" | "other"; facultyId?: number | null;
}) {
  const [existing] = await db.select({ id: t.batch.id }).from(t.batch).where(eq(t.batch.code, opts.code));
  if (existing) return;
  const [prog] = await db.select({ id: t.programme.id }).from(t.programme)
    .innerJoin(t.campus, eq(t.programme.campusId, t.campus.id))
    .where(and(eq(t.campus.code, opts.campus), eq(t.programme.code, opts.programme)));
  if (!prog) { console.warn(`seedAlumni: no programme ${opts.programme} at ${opts.campus}, skipped ${opts.code}`); return; } // older databases may lack a campus

  await db.transaction(async (tx) => {
    const [b] = await tx.insert(t.batch).values({
      programmeId: prog.id, code: opts.code, admissionYear: opts.admissionYear, year: opts.year, semester: opts.semester,
    }).returning({ id: t.batch.id });
    await tx.insert(t.student).values(opts.rolls.map((rollNo, i) => ({
      rollNo, name: NAMES[i % NAMES.length], batchId: b.id, birthDate: BIRTH, graduatedOn: opts.graduatedOn, gender: opts.gender ?? null,
    })));
    await tx.insert(t.subject).values(opts.subjects.map(([code, name]) => ({ batchId: b.id, facultyId: opts.facultyId ?? null, code, name, marksStatus: "locked" as const })));
  });
}

const rolls = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}-${String(i + 1).padStart(4, "0")}`);

export async function seedAlumni(password: string) {
  void password;
  await db.update(t.programme).set({ durationYears: 2 }).where(like(t.programme.code, "MBA%"));
  const [engFaculty] = await db.select({ id: t.staff.id }).from(t.staff)
    .innerJoin(t.campus, eq(t.staff.campusId, t.campus.id))
    .where(and(eq(t.campus.code, "ENG"), eq(t.staff.role, "faculty")));
  if (!engFaculty) throw new Error("No ENG faculty to teach ME-2023");
  await addBatch({
    campus: "ENG", programme: "CSE", code: "CSE-2020", admissionYear: 2020, year: 4, semester: 8,
    rolls: rolls("ENG-20-CSE", 8), graduatedOn: "2024-06-30", subjects: [["CS801", "Capstone Project"]],
  });
  await addBatch({
    campus: "MGT", programme: "MBA", code: "MBA-2023", admissionYear: 2023, year: 2, semester: 4,
    rolls: rolls("MGT-23-MBA", 8), graduatedOn: "2025-06-30", subjects: [["MB401", "Strategic Management"]],
  });
  await addBatch({
    campus: "PHR", programme: "BPH", code: "BPH-2020", admissionYear: 2020, year: 4, semester: 8,
    rolls: rolls("PHR-20-BPH", 8), graduatedOn: "2024-06-30", subjects: [["BP801T", "Pharmacy Practice"]],
  });
  await addBatch({
    campus: "ENG", programme: "ME", code: "ME-2023", admissionYear: 2023, year: 2, semester: 4,
    rolls: rolls("ENG-23-ME", 3), graduatedOn: null, gender: "male", facultyId: engFaculty.id, subjects: [["ME401", "Fluid Mechanics"]],
  });
  await addBatch({
    campus: "ENG", programme: "CSE", code: "CSE-2021", admissionYear: 2021, year: 4, semester: 8,
    rolls: rolls("ENG-21-CSE", 3), graduatedOn: null, subjects: [["CS802", "Major Project"], ["CS803", "Industrial Training"]],
  });
}
