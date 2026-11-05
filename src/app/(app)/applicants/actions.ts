"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/access";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { applicant, applicantDocument, batch, programme } from "@/server/schema";
import { istDate } from "@/domain/attendance";
import { type CsvIssue, parseApplicantsCsv } from "@/domain/applicants";
import { isMinor } from "@/domain/templates";

type Result = { error?: string };
type ImportResult = Result & { errors?: CsvIssue[]; count?: number };

const pick = z.coerce.number().int().positive();
const DOC_STATUS = z.enum(["pending", "received", "verified"], { message: "Pick a status from the list." });

export async function updateApplicantDocument(fd: FormData): Promise<Result> {
  const v = await requireAdmin();
  const id = pick.safeParse(fd.get("applicantId"));
  if (!id.success) return { error: "Pick an applicant." };
  const name = z.string().trim().min(1, "Pick a document.").safeParse(fd.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };
  const status = DOC_STATUS.safeParse(fd.get("status"));
  if (!status.success) return { error: status.error.issues[0].message };

  const error = await db.transaction(async (tx) => {
    const [app] = await tx.select({ id: applicant.id, status: applicant.status }).from(applicant)
      .innerJoin(programme, eq(applicant.programmeId, programme.id))
      .where(and(eq(applicant.id, id.data), eq(programme.campusId, v.campusId)));
    if (!app) return "Applicant not found on this campus.";
    if (app.status !== "applied") return "Documents can only change while the applicant is applied.";

    const [old] = await tx.select({ name: applicantDocument.name, status: applicantDocument.status }).from(applicantDocument)
      .where(and(eq(applicantDocument.applicantId, id.data), eq(applicantDocument.name, name.data)));
    const [row] = await tx.insert(applicantDocument)
      .values({ applicantId: id.data, name: name.data, status: status.data })
      .onConflictDoUpdate({
        target: [applicantDocument.applicantId, applicantDocument.name],
        set: { status: status.data, updatedAt: new Date() },
      })
      .returning({ name: applicantDocument.name, status: applicantDocument.status });
    await audit(tx, v, {
      action: "applicant.document", entity: "applicant", entityId: id.data,
      oldValue: old ?? null, newValue: row,
    });
    return null;
  });
  if (error) return { error };
  revalidatePath("/applicants");
  return {};
}

export async function saveConsent(fd: FormData): Promise<Result> {
  const v = await requireAdmin();
  const id = pick.safeParse(fd.get("applicantId"));
  if (!id.success) return { error: "Pick an applicant." };
  const raw = String(fd.get("consentDate") ?? "").trim();
  if (raw !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { error: "Consent date must be a date." };
  const consentAt = raw === "" ? null : new Date(`${raw}T00:00:00+05:30`);
  if (consentAt && Number.isNaN(consentAt.getTime())) return { error: "Consent date must be a date." };

  const error = await db.transaction(async (tx) => {
    const [app] = await tx.select({ id: applicant.id, status: applicant.status, birthDate: applicant.birthDate, parentConsentAt: applicant.parentConsentAt })
      .from(applicant)
      .innerJoin(programme, eq(applicant.programmeId, programme.id))
      .where(and(eq(applicant.id, id.data), eq(programme.campusId, v.campusId)));
    if (!app) return "Applicant not found on this campus.";
    if (app.status !== "applied") return "Consent can only change while the applicant is applied.";
    if (!isMinor(app.birthDate, istDate())) return "Parent consent applies to minors only.";

    const [row] = await tx.update(applicant).set({ parentConsentAt: consentAt }).where(eq(applicant.id, id.data))
      .returning({ parentConsentAt: applicant.parentConsentAt });
    await audit(tx, v, {
      action: "applicant.consent", entity: "applicant", entityId: id.data,
      oldValue: { parentConsentAt: app.parentConsentAt }, newValue: { parentConsentAt: row.parentConsentAt },
    });
    return null;
  });
  if (error) return { error };
  revalidatePath("/applicants");
  return {};
}

export async function importApplicants(batchId: number, csvText: string): Promise<ImportResult> {
  const v = await requireAdmin();
  const bid = pick.safeParse(batchId);
  if (!bid.success) return { error: "Pick a batch." };

  const parsed = parseApplicantsCsv(csvText);
  if (parsed.errors.length > 0) return { errors: parsed.errors, error: "Fix the errors and upload the file again. Nothing was imported." };
  if (parsed.rows.length === 0) return { error: "The file has no applicant rows." };

  const error = await db.transaction(async (tx) => {
    const [b] = await tx.select({ id: batch.id, programmeId: batch.programmeId }).from(batch)
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(and(eq(batch.id, bid.data), eq(programme.campusId, v.campusId)));
    if (!b) return "Pick a batch on this campus.";

    await tx.insert(applicant).values(parsed.rows.map((r) => ({
      programmeId: b.programmeId, batchId: b.id, name: r.name, birthDate: r.birthDate, category: r.category,
      guardianName: r.guardianName, guardianPhone: r.guardianPhone, guardianEmail: r.guardianEmail,
    })));
    await audit(tx, v, { action: "applicant.import", entity: "batch", entityId: b.id, newValue: { count: parsed.rows.length } });
    return null;
  });
  if (error) return { error };
  revalidatePath("/applicants");
  return { count: parsed.rows.length };
}
