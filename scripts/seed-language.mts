import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/server/db";
import * as t from "../src/server/schema";

// Idempotent backfill: some guardians read Odia, and one named guardian (the e2e sign-in) is pinned to it.
export async function seedLanguage() {
  const [anyOr] = await db.select({ id: t.guardian.id }).from(t.guardian).where(eq(t.guardian.language, "or")).limit(1);
  if (!anyOr) {
    await db.update(t.guardian).set({ language: "or" }).where(sql`${t.guardian.id} % 3 = 0`);
  }
  const [pallavi] = await db.select({ id: t.guardian.id }).from(t.guardian)
    .innerJoin(t.guardianStudent, eq(t.guardianStudent.guardianId, t.guardian.id))
    .innerJoin(t.student, eq(t.student.id, t.guardianStudent.studentId))
    .where(and(eq(t.guardian.name, "Pallavi Jena"), eq(t.student.rollNo, "ENG-24-CSE-0001")))
    .limit(1);
  if (pallavi) await db.update(t.guardian).set({ language: "or" }).where(eq(t.guardian.id, pallavi.id));
}
