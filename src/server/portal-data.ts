import { eq } from "drizzle-orm";
import { db } from "./db";
import { batch, campus, programme, staff, student } from "./schema";

/** Header facts for the portal's one student. */
export async function portalStudent(studentId: number) {
  const [s] = await db.select({
    id: student.id, name: student.name, rollNo: student.rollNo, birthDate: student.birthDate, batchId: student.batchId,
    guardianName: student.guardianName, guardianPhone: student.guardianPhone, parentConsentAt: student.parentConsentAt,
    batch: batch.code, year: batch.year, semester: batch.semester, programme: programme.name, cutoff: programme.attendanceCutoff,
    campus: campus.name, campusId: campus.id, mentor: staff.name, mentorId: staff.id,
  }).from(student)
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .innerJoin(campus, eq(programme.campusId, campus.id))
    .leftJoin(staff, eq(student.mentorId, staff.id))
    .where(eq(student.id, studentId));
  return s;
}
