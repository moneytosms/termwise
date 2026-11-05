import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "../src/server/db";
import * as t from "../src/server/schema";

// Idempotent backfill for the scheme-of-examination data. Runs on fresh and already-seeded databases.
export async function seedScheme() {
  await seedProfiles();
  await seedLabs();
  await seedComponents();
  await seedMarks();
}

const CREST = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M32 4L58 13V32C58 47 46 56 32 61C18 56 6 47 6 32V13Z" fill="#1d4e89"/><path d="M32 12L50 18V32C50 42 43 49 32 53C21 49 14 42 14 32V18Z" fill="#f2b705"/><text x="32" y="39" font-family="Georgia,serif" font-size="20" font-weight="bold" text-anchor="middle" fill="#1d4e89">TI</text></svg>`;
const LOGO = `data:image/svg+xml;base64,${Buffer.from(CREST).toString("base64")}`;
const AFFILIATION = "Affiliated to Biju Patnaik University of Technology, Odisha · Approved by AICTE";
const RECEIPT_FOOTER = "This is a computer-generated receipt and does not require a signature.";

// Fictional profiles; domains end in .example
const PROFILES: Record<string, Partial<typeof t.campus.$inferInsert>> = {
  ENG: {
    legalName: "Termwise Institute of Engineering & Technology", tagline: "Engineering for the real world",
    addressLine1: "Plot 14, Patia Campus Road", city: "Bhubaneswar", state: "Odisha", pincode: "751024",
    phone: "+91 674 255 0140", email: "office@tiet-bbsr.example", website: "https://tiet-bbsr.example",
    affiliation: AFFILIATION, registrationNo: "AICTE-OR-2009-0417", gstin: "21AAACT0000A1Z5", receiptFooter: RECEIPT_FOOTER,
  },
  MGT: {
    legalName: "Termwise School of Management", tagline: "Leadership, built on practice",
    addressLine1: "Plot 3, Sector 9", city: "Bhubaneswar", state: "Odisha", pincode: "751016",
    phone: "+91 674 255 0190", email: "office@tsm-bbsr.example", website: "https://tsm-bbsr.example",
    affiliation: AFFILIATION, registrationNo: "AICTE-OR-2011-0233", gstin: "21AAGCT0000M1Z3", receiptFooter: RECEIPT_FOOTER,
  },
};

async function seedProfiles() {
  for (const [code, profile] of Object.entries(PROFILES)) {
    await db.update(t.campus).set({ ...profile, logoDataUrl: LOGO })
      .where(and(eq(t.campus.code, code), isNull(t.campus.logoDataUrl)));
  }
}

// One lab per engineering batch, unless a lab already exists: the lab-like name, else the last subject.
async function seedLabs() {
  const existing = await db.select({ id: t.subject.id }).from(t.subject).where(eq(t.subject.kind, "lab")).limit(1);
  if (existing.length) return;
  const subjects = await db.select({ id: t.subject.id, batchId: t.subject.batchId, name: t.subject.name })
    .from(t.subject)
    .innerJoin(t.batch, eq(t.batch.id, t.subject.batchId))
    .innerJoin(t.programme, eq(t.programme.id, t.batch.programmeId))
    .innerJoin(t.campus, eq(t.campus.id, t.programme.campusId))
    .where(eq(t.campus.code, "ENG"))
    .orderBy(t.subject.id);
  for (const list of Map.groupBy(subjects, (s) => s.batchId).values()) {
    const lab = list.find((s) => /lab/i.test(s.name)) ?? list.at(-1)!;
    await db.update(t.subject).set({ kind: "lab", theoryScale: 70 }).where(eq(t.subject.id, lab.id));
  }
}

// Existing "Mid-term" is the internal test; the new "Mid-term exam" is the section mid component.
async function seedComponents() {
  await db.update(t.markComponent).set({ name: "Internal test" })
    .where(and(eq(t.markComponent.name, "Mid-term"), eq(t.markComponent.section, "internal")));
  const subjects = await db.select().from(t.subject);
  const comps = await db.select().from(t.markComponent);
  for (const s of subjects) {
    const mine = comps.filter((c) => c.subjectId === s.id);
    if (mine.some((c) => c.section === "mid")) continue;
    const parts: [string, typeof t.markComponent.$inferInsert.section, number][] = [
      ["Mid-term exam", "mid", s.midMax],
      ["End-term exam", "end", s.endMax],
      ...(s.kind === "lab" ? [
        ["Lab exam", "lab_exam", s.labExamMax], ["Viva", "viva", s.vivaMax], ["Continuous evaluation", "ce", s.ceMax],
      ] as [string, typeof t.markComponent.$inferInsert.section, number][] : []),
    ];
    const base = mine.length ? Math.max(...mine.map((c) => c.position)) + 1 : 0;
    await db.insert(t.markComponent).values(parts.map(([name, section, maxMarks], i) => ({ subjectId: s.id, name, section, maxMarks, position: base + i })));
  }
}

// Deterministic 0..1 from a seed, so a rerun on a fresh database gives the same marks.
const unit = (seed: number) => ((seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

// Marks for every non-internal component that has none yet. Draft subjects keep them null.
async function seedMarks() {
  const comps = await db.select({
    id: t.markComponent.id, maxMarks: t.markComponent.maxMarks, batchId: t.subject.batchId, marksStatus: t.subject.marksStatus,
  }).from(t.markComponent)
    .innerJoin(t.subject, eq(t.subject.id, t.markComponent.subjectId))
    .where(ne(t.markComponent.section, "internal"));
  const filled = new Set((await db.selectDistinct({ componentId: t.mark.componentId }).from(t.mark)).map((r) => r.componentId));
  const students = await db.select({ id: t.student.id, batchId: t.student.batchId }).from(t.student);
  const byBatch = Map.groupBy(students, (s) => s.batchId);

  const rows: (typeof t.mark.$inferInsert)[] = [];
  for (const c of comps) {
    if (filled.has(c.id)) continue;
    for (const st of byBatch.get(c.batchId) ?? []) {
      const marks = c.marksStatus === "draft" ? null : Math.round(c.maxMarks * (0.55 + 0.35 * unit(c.id * 1000 + st.id)) * 2) / 2;
      rows.push({ componentId: c.id, studentId: st.id, marks });
    }
  }
  for (let i = 0; i < rows.length; i += 2000) await db.insert(t.mark).values(rows.slice(i, i + 2000));
}
