import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "../src/server/db";
import * as t from "../src/server/schema";
import { awardAmount, eligibilityError, semesterInstalments, spread } from "../src/domain/scholarship";

// Idempotent backfill for scholarships. A campus with no schemes gets three, and up to three eligible students with instalments are awarded one each. Campuses that already have schemes are never touched.
const GENERAL_ROLLS = ["ENG-24-CSE-0412", "ENG-24-ME-0177", "MBA-25-0093"];
const paidSql = sql<number>`(select coalesce(sum(p.amount_paise),0) from ${t.feePayment} p where p.instalment_id=fee_instalment.id)`.mapWith(Number);

export async function seedScholarships(password: string) {
  void password;
  const campuses = await db.select({ id: t.campus.id }).from(t.campus);
  for (const c of campuses) {
    const [existing] = await db.select({ id: t.scholarshipScheme.id }).from(t.scholarshipScheme)
      .where(eq(t.scholarshipScheme.campusId, c.id)).limit(1);
    if (existing) continue;

    await db.transaction(async (tx) => {
      const schemes = await tx.insert(t.scholarshipScheme).values([
        { campusId: c.id, name: "Post-matric scholarship (SC/ST)", fundingSource: "government", kind: "percent", value: 50, categories: ["sc", "st"], active: true },
        { campusId: c.id, name: "Merit scholarship", fundingSource: "institution", kind: "fixed", value: 1000000, categories: [], active: true },
        { campusId: c.id, name: "Odisha Foundation grant", fundingSource: "non_government", kind: "percent", value: 25, categories: [], active: true },
      ]).returning();

      const candidates = await tx.select({ id: t.student.id, category: t.student.category, batchSemester: t.batch.semester })
        .from(t.student)
        .innerJoin(t.batch, eq(t.student.batchId, t.batch.id))
        .innerJoin(t.programme, eq(t.batch.programmeId, t.programme.id))
        .where(and(eq(t.programme.campusId, c.id), notInArray(t.student.rollNo, GENERAL_ROLLS)))
        .orderBy(t.student.id);

      let awarded = 0;
      for (const s of candidates) {
        if (awarded === 3) break;
        const instalments = await tx.select({
          id: t.feeInstalment.id, dueDate: t.feeInstalment.dueDate, amountPaise: t.feeInstalment.amountPaise,
          scholarshipPaise: t.feeInstalment.scholarshipPaise, semester: t.feeInstalment.semester, paidPaise: paidSql,
        }).from(t.feeInstalment).where(eq(t.feeInstalment.studentId, s.id));
        const semesterList = semesterInstalments(instalments, s.batchSemester, s.batchSemester);
        const total = semesterList.reduce((sum, i) => sum + i.amountPaise, 0);
        if (total === 0) continue;

        const scheme = schemes.find((sc) => eligibilityError(sc, s.category) === null);
        if (!scheme) continue;
        const amount = awardAmount(scheme, total);
        if (amount <= 0) continue;

        for (const inc of spread(semesterList, amount)) {
          await tx.update(t.feeInstalment).set({ scholarshipPaise: sql`${t.feeInstalment.scholarshipPaise} + ${inc.addPaise}` })
            .where(eq(t.feeInstalment.id, inc.id));
        }
        await tx.insert(t.scholarshipAward).values({ studentId: s.id, schemeId: scheme.id, semester: s.batchSemester, amountPaise: amount });
        awarded++;
      }
    });
  }
}
