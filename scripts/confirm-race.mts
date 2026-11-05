import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/server/db";
import * as t from "../src/server/schema";
import { confirmApplicant } from "../src/server/admission";
import { applicableDocs } from "../src/domain/applicants";
import { confirmBlocker } from "../src/domain/admission";
import { checklist } from "../src/domain/applicants";
import { istDate } from "../src/domain/attendance";

// Two concurrent confirms in one batch must get distinct, consecutive roll numbers; a repeat confirm must fail.
async function confirmable() {
  const rows = await db.select().from(t.applicant)
    .innerJoin(t.batch, eq(t.applicant.batchId, t.batch.id))
    .where(and(eq(t.applicant.status, "applied"), eq(t.batch.code, "CSE-2024")));
  const out: typeof rows = [];
  for (const r of rows) {
    const req = await db.select().from(t.requiredDocument).where(eq(t.requiredDocument.programmeId, r.applicant.programmeId));
    const st = await db.select().from(t.applicantDocument).where(eq(t.applicantDocument.applicantId, r.applicant.id));
    const items = checklist(applicableDocs(req, r.applicant.category), st);
    if (!confirmBlocker({ items, birthDate: r.applicant.birthDate, parentConsentAt: r.applicant.parentConsentAt, status: "applied" }, istDate())) out.push(r);
  }
  return out;
}

async function main() {
  let picks = await confirmable();
  if (picks.length < 2) {
    const rows = await db.select().from(t.applicant)
      .innerJoin(t.batch, eq(t.applicant.batchId, t.batch.id))
      .where(and(eq(t.applicant.status, "applied"), eq(t.batch.code, "CSE-2024")));
    const adults = rows.filter((r) => Number(istDate().slice(0, 4)) - Number(r.applicant.birthDate.slice(0, 4)) > 18).slice(0, 2);
    for (const { applicant: a } of adults) {
      const req = await db.select().from(t.requiredDocument).where(eq(t.requiredDocument.programmeId, a.programmeId));
      for (const name of applicableDocs(req, a.category)) {
        await db.insert(t.applicantDocument).values({ applicantId: a.id, name, status: "verified" })
          .onConflictDoUpdate({ target: [t.applicantDocument.applicantId, t.applicantDocument.name], set: { status: "verified" } });
      }
    }
    picks = await confirmable();
  }
  if (picks.length < 2) throw new Error("Need two confirmable applicants in CSE-2024");
  const [a, b] = picks;

  const [row] = await db.select().from(t.staff).innerJoin(t.campus, eq(t.staff.campusId, t.campus.id))
    .where(and(eq(t.staff.role, "office_admin"), eq(t.campus.code, "ENG")));
  const actor = {
    userId: row.staff.userId!, name: row.staff.name, staffId: row.staff.id, campusId: row.staff.campusId,
    departmentId: row.staff.departmentId, role: "office_admin" as const,
  };

  const results = await Promise.all([confirmApplicant(actor, a.applicant.id), confirmApplicant(actor, b.applicant.id)]);
  console.log(results);
  if (results.some((r) => "error" in r)) throw new Error("A confirm failed");
  const nums = results.map((r) => Number((r as { rollNo: string }).rollNo.slice(-4))).sort((x, y) => x - y);
  if (nums[1] !== nums[0] + 1) throw new Error(`Roll numbers not consecutive: ${nums.join(", ")}`);

  const again = await confirmApplicant(actor, a.applicant.id);
  console.log(again);
  if (!("error" in again)) throw new Error("A second confirm of the same applicant succeeded");
  console.log("ok");
}

main().then(() => pool.end(), (e) => { console.error(e); process.exit(1); });
