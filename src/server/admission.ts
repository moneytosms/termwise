import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { confirmBlocker, nextRollNo } from "@/domain/admission";
import { applicableDocs, checklist } from "@/domain/applicants";
import { istDate } from "@/domain/attendance";
import type { Viewer } from "./access";
import { audit } from "./audit";
import { db, type Tx } from "./db";
import {
  account, applicant, applicantDocument, batch, campus, feeInstalment, guardian, guardianStudent,
  programme, requiredDocument, student, studentDocument, user,
} from "./schema";

// Thrown inside the transaction to roll everything back with a message for the caller
class Stop extends Error {}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function emailBase(name: string) {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z ]/g, "").trim().split(/\s+/).join(".");
}

async function freeEmail(tx: Tx, preferred: string | null, name: string) {
  const taken = async (email: string) => (await tx.select({ id: user.id }).from(user).where(eq(user.email, email))).length > 0;
  if (preferred && !(await taken(preferred))) return preferred;
  const base = emailBase(name) || "guardian";
  let email = `${base}@termwise.demo`;
  for (let i = 2; await taken(email); i++) email = `${base}${i}@termwise.demo`;
  return email;
}

async function onCampus(tx: Tx, actor: Viewer, id: number) {
  const [row] = await tx.select({ id: applicant.id }).from(applicant)
    .innerJoin(programme, eq(applicant.programmeId, programme.id))
    .where(and(eq(applicant.id, id), eq(programme.campusId, actor.campusId)));
  return !!row;
}

export async function confirmApplicant(actor: Viewer, applicantId: number): Promise<{ rollNo: string; studentId: number } | { error: string }> {
  // Demo password for every generated login
  const hash = await hashPassword("termwise-demo");
  const today = istDate();
  try {
    return await db.transaction(async (tx) => {
      if (!(await onCampus(tx, actor, applicantId))) throw new Stop("Applicant not found on this campus.");

      // 1. Claim the applicant: only one caller can move applied -> confirmed
      const [app] = await tx.update(applicant).set({ status: "confirmed", decidedAt: new Date() })
        .where(and(eq(applicant.id, applicantId), eq(applicant.status, "applied"))).returning();
      if (!app) throw new Stop("Already decided.");

      // 2. Re-check the blockers from fresh rows
      const required = await tx.select({ name: requiredDocument.name, categories: requiredDocument.categories })
        .from(requiredDocument).where(eq(requiredDocument.programmeId, app.programmeId));
      const statuses = await tx.select({ name: applicantDocument.name, status: applicantDocument.status, fileId: applicantDocument.fileId })
        .from(applicantDocument).where(eq(applicantDocument.applicantId, app.id));
      const items = checklist(applicableDocs(required, app.category), statuses);
      const blocker = confirmBlocker({ items, birthDate: app.birthDate, parentConsentAt: app.parentConsentAt, status: "applied" }, today);
      if (blocker) throw new Stop(blocker);

      // 3. Lock the batch row so concurrent confirms in this batch queue up before reading rolls
      const [b] = await tx.select().from(batch).where(eq(batch.id, app.batchId)).for("update");
      const [p] = await tx.select({ code: programme.code, semesterFeePaise: programme.semesterFeePaise, campusCode: campus.code })
        .from(programme).innerJoin(campus, eq(programme.campusId, campus.id)).where(eq(programme.id, b.programmeId));
      const rolls = (await tx.select({ rollNo: student.rollNo }).from(student).where(eq(student.batchId, b.id)))
        .map((r) => r.rollNo).filter((r) => /\d{4}$/.test(r));
      const rollNo = nextRollNo(rolls, `${p.campusCode}-${String(b.admissionYear).slice(2)}-${p.code}-`);

      // 4. Student, carried checklist, fee instalments
      const [s] = await tx.insert(student).values({
        rollNo, name: app.name, batchId: b.id, mentorId: null, birthDate: app.birthDate,
        guardianName: app.guardianName, guardianPhone: app.guardianPhone, parentConsentAt: app.parentConsentAt,
      }).returning({ id: student.id });
      if (items.length > 0) {
        await tx.insert(studentDocument).values(items.map((i) => ({
          studentId: s.id, name: i.name, status: i.status, fileId: statuses.find((d) => d.name === i.name)?.fileId ?? null,
        })));
      }
      if (p.semesterFeePaise > 0) {
        const half = Math.round(p.semesterFeePaise / 2);
        await tx.insert(feeInstalment).values([
          { studentId: s.id, label: "Instalment 1", dueDate: addDays(today, 30), amountPaise: half, scholarshipPaise: 0 },
          { studentId: s.id, label: "Instalment 2", dueDate: addDays(today, 120), amountPaise: half, scholarshipPaise: 0 },
        ]);
      }

      // 5. Guardian login
      const userId = randomUUID();
      const email = await freeEmail(tx, app.guardianEmail?.trim().toLowerCase() || null, app.guardianName);
      await tx.insert(user).values({ id: userId, name: app.guardianName, email });
      await tx.insert(account).values({ id: randomUUID(), accountId: userId, providerId: "credential", userId, password: hash });
      const [g] = await tx.insert(guardian).values({ userId, name: app.guardianName, phone: app.guardianPhone }).returning({ id: guardian.id });
      await tx.insert(guardianStudent).values({ guardianId: g.id, studentId: s.id, relation: "Guardian" });

      // 6. Link and audit
      await tx.update(applicant).set({ studentId: s.id }).where(eq(applicant.id, app.id));
      await audit(tx, actor, { action: "applicant.confirm", entity: "applicant", entityId: app.id, newValue: { rollNo, studentId: s.id } });
      return { rollNo, studentId: s.id };
    });
  } catch (e) {
    if (e instanceof Stop) return { error: e.message };
    throw e;
  }
}

export async function rejectApplicant(actor: Viewer, id: number, reason: string): Promise<{ ok: true } | { error: string }> {
  const text = reason.trim();
  if (text.length < 5 || text.length > 500) return { error: "Reason must be 5 to 500 characters." };
  try {
    return await db.transaction(async (tx) => {
      if (!(await onCampus(tx, actor, id))) throw new Stop("Applicant not found on this campus.");
      const [row] = await tx.update(applicant).set({ status: "rejected", rejectReason: text, decidedAt: new Date() })
        .where(and(eq(applicant.id, id), eq(applicant.status, "applied"))).returning({ id: applicant.id });
      if (!row) throw new Stop("Already decided.");
      await audit(tx, actor, { action: "applicant.reject", entity: "applicant", entityId: id, newValue: { reason: text } });
      return { ok: true as const };
    });
  } catch (e) {
    if (e instanceof Stop) return { error: e.message };
    throw e;
  }
}
