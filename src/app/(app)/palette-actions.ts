"use server";

import { and, eq, ilike, or } from "drizzle-orm";
import { requireViewer, studentScope } from "@/server/access";
import { db } from "@/server/db";
import { batch, programme, student } from "@/server/schema";

/** Students this viewer may see, matched by name or roll number. Top 8 for the command palette. */
export async function searchStudents(term: string) {
  const v = await requireViewer();
  const like = `%${term.trim()}%`;
  return db.select({ id: student.id, rollNo: student.rollNo, name: student.name, programme: programme.name }).from(student)
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(studentScope(v), or(ilike(student.name, like), ilike(student.rollNo, like))))
    .orderBy(student.rollNo).limit(8);
}
