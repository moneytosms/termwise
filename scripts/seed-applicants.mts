import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "../src/server/db";
import * as t from "../src/server/schema";
import { applicableDocs } from "../src/domain/applicants";

// Idempotent backfill for the applicant pipeline. Each part runs only while its table is still empty, so existing rows are never touched.

const FEE_PAISE: Record<string, number> = { CSE: 9000000, ME: 9000000, MBA: 12000000, BPH: 5500000 };

const DOCS: { name: string; categories: string[] | null }[] = [
  { name: "10th marksheet", categories: null },
  { name: "12th marksheet", categories: null },
  { name: "Transfer certificate", categories: null },
  { name: "Aadhaar card", categories: null },
  { name: "Passport photo", categories: null },
  { name: "Caste certificate", categories: ["obc", "sc", "st"] },
  { name: "EWS certificate", categories: ["ews"] },
];

// One letter per applicable document, in DOCS order: v verified, r received, p pending.
type Spec = { name: string; programme: "CSE" | "MBA" | "BPH"; category: string; birthDate: string; consent?: boolean; docs: string };
const SPECS: Spec[] = [
  { name: "Ritika Nayak", programme: "CSE", category: "general", birthDate: "2005-06-18", docs: "vvvvv" },
  { name: "Sanjay Pradhan", programme: "CSE", category: "general", birthDate: "2005-02-09", docs: "vvvvr" },
  { name: "Priya Behera", programme: "CSE", category: "obc", birthDate: "2008-12-15", consent: true, docs: "vvvvvv" },
  { name: "Rohan Sethi", programme: "CSE", category: "sc", birthDate: "2009-04-03", docs: "vvrpvp" },
  { name: "Manas Jena", programme: "CSE", category: "st", birthDate: "2009-09-21", docs: "rpvpvp" },
  { name: "Aditi Mishra", programme: "CSE", category: "ews", birthDate: "2005-11-02", docs: "vvvvvv" },
  { name: "Deepika Swain", programme: "CSE", category: "general", birthDate: "2006-01-27", docs: "vrrpp" },
  { name: "Soumya Panda", programme: "CSE", category: "obc", birthDate: "2005-07-30", docs: "vvvpvp" },
  { name: "Tapas Rout", programme: "CSE", category: "general", birthDate: "2004-10-12", docs: "vvrvr" },
  { name: "Lipsa Das", programme: "CSE", category: "sc", birthDate: "2005-03-08", docs: "vvvvvv" },
  { name: "Gyana Samal", programme: "CSE", category: "st", birthDate: "2006-06-19", docs: "vvvpvr" },
  { name: "Smruti Biswal", programme: "CSE", category: "ews", birthDate: "2005-12-24", docs: "rpvpvp" },
  { name: "Bijaya Mohanty", programme: "MBA", category: "general", birthDate: "2003-02-17", docs: "vvrpv" },
  { name: "Subhasini Patra", programme: "MBA", category: "obc", birthDate: "2004-09-05", docs: "vvvpvp" },
  { name: "Abhishek Dash", programme: "MBA", category: "general", birthDate: "2003-08-28", docs: "rvppv" },
  { name: "Nilima Sahu", programme: "MBA", category: "ews", birthDate: "2004-05-11", docs: "vvpvvr" },
  { name: "Sushree Dash", programme: "BPH", category: "general", birthDate: "2005-04-14", docs: "vvvvv" },
  { name: "Bibhuti Sahoo", programme: "BPH", category: "obc", birthDate: "2004-08-22", docs: "vvpvvv" },
  { name: "Kiran Pattanaik", programme: "BPH", category: "ews", birthDate: "2006-02-11", docs: "vvvvvr" },
];
const GUARDIAN_FIRST = ["Prakash", "Ramesh", "Sarat", "Biswanath", "Dillip", "Kailash", "Manoj", "Pradeep"];
const STATUS: Record<string, "verified" | "received" | "pending"> = { v: "verified", r: "received", p: "pending" };

export async function seedApplicants(password: string) {
  void password;

  for (const [code, paise] of Object.entries(FEE_PAISE)) {
    await db.update(t.programme).set({ semesterFeePaise: paise })
      .where(and(eq(t.programme.code, code), eq(t.programme.semesterFeePaise, 0)));
  }

  const [{ docs }] = await db.select({ docs: count() }).from(t.requiredDocument);
  if (docs === 0) {
    const programmes = await db.select({ id: t.programme.id }).from(t.programme);
    await db.insert(t.requiredDocument).values(programmes.flatMap((p) =>
      DOCS.map((d) => ({ programmeId: p.id, name: d.name, categories: d.categories }))));
  }

  const [{ applicants }] = await db.select({ applicants: count() }).from(t.applicant);
  if (applicants > 0) return;

  const programmes = await db.select().from(t.programme).where(inArray(t.programme.code, ["CSE", "MBA", "BPH"]));
  const batches = await db.select().from(t.batch).where(inArray(t.batch.code, ["CSE-2024", "MBA-2025", "BPH-2024"]));
  const required = await db.select().from(t.requiredDocument);
  const batchFor = (programme: string) => {
    const p = programmes.find((x) => x.code === programme)!;
    return { programmeId: p.id, batchId: batches.find((b) => b.programmeId === p.id)!.id };
  };

  await db.transaction(async (tx) => {
    for (const [i, spec] of SPECS.entries()) {
      const { programmeId, batchId } = batchFor(spec.programme);
      const applicable = applicableDocs(
        required.filter((r) => r.programmeId === programmeId),
        spec.category,
      );
      const states = [...spec.docs].map((c) => STATUS[c]);
      if (states.length !== applicable.length) {
        throw new Error(`${spec.name}: ${applicable.length} applicable documents but ${states.length} statuses`);
      }
      const [row] = await tx.insert(t.applicant).values({
        programmeId,
        batchId,
        name: spec.name,
        birthDate: spec.birthDate,
        category: spec.category as "general" | "obc" | "sc" | "st" | "ews",
        guardianName: `${GUARDIAN_FIRST[i % GUARDIAN_FIRST.length]} ${spec.name.split(" ").at(-1)}`,
        guardianPhone: `+91 90000 0${5001 + i}`,
        guardianEmail: null,
        parentConsentAt: spec.consent ? new Date("2026-10-20T10:00:00+05:30") : null,
      }).returning({ id: t.applicant.id });
      await tx.insert(t.applicantDocument).values(applicable.map((name, j) => ({ applicantId: row.id, name, status: states[j] })));
    }
  });
}
