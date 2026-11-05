import { and, eq, inArray } from "drizzle-orm";
import { applicableDocs, checklist, checklistComplete, checklistProgress, type DocState } from "@/domain/applicants";
import { db } from "@/server/db";
import { applicant, applicantDocument, batch, programme, requiredDocument, student } from "@/server/schema";

export type ApplicantRow = {
  id: number; name: string; programmeId: number; programme: string; batch: string; category: string;
  status: "applied" | "confirmed" | "rejected"; verified: number; total: number; complete: boolean;
};

export type ApplicantDetail = {
  id: number; name: string; programme: string; batch: string; category: string; birthDate: string;
  status: "applied" | "confirmed" | "rejected"; rejectReason: string | null; parentConsentAt: Date | null;
  guardianName: string; guardianPhone: string; guardianEmail: string | null;
  studentId: number | null; rollNo: string | null;
  checklist: (DocState & { fileId: number | null })[];
};

/** Every applicant on this campus with the checklist progress for their category. */
export async function listApplicants(campusId: number): Promise<ApplicantRow[]> {
  const rows = await db.select({
    id: applicant.id, name: applicant.name, category: applicant.category, status: applicant.status,
    programmeId: applicant.programmeId, programme: programme.code, batch: batch.code,
  }).from(applicant)
    .innerJoin(programme, eq(applicant.programmeId, programme.id))
    .innerJoin(batch, eq(applicant.batchId, batch.id))
    .where(eq(programme.campusId, campusId))
    .orderBy(applicant.name);
  if (rows.length === 0) return [];

  const docs = await requiredDocsByProgramme(campusId);
  const statuses = await statusesByApplicant(rows.map((r) => r.id));
  return rows.map((r) => {
    const items = checklist(applicableDocs(docs.get(r.programmeId) ?? [], r.category), statuses.get(r.id) ?? []);
    return { ...r, ...checklistProgress(items), complete: checklistComplete(items) };
  });
}

/** One applicant on this campus with their full checklist, or null. */
export async function getApplicantDetail(campusId: number, id: number): Promise<ApplicantDetail | null> {
  const [row] = await db.select({
    id: applicant.id, name: applicant.name, category: applicant.category, status: applicant.status,
    birthDate: applicant.birthDate, rejectReason: applicant.rejectReason, parentConsentAt: applicant.parentConsentAt,
    guardianName: applicant.guardianName, guardianPhone: applicant.guardianPhone, guardianEmail: applicant.guardianEmail,
    studentId: applicant.studentId, rollNo: student.rollNo,
    programmeId: applicant.programmeId, programme: programme.code, batch: batch.code,
  }).from(applicant)
    .innerJoin(programme, eq(applicant.programmeId, programme.id))
    .innerJoin(batch, eq(applicant.batchId, batch.id))
    .leftJoin(student, eq(applicant.studentId, student.id))
    .where(and(eq(applicant.id, id), eq(programme.campusId, campusId)));
  if (!row) return null;

  const docs = (await requiredDocsByProgramme(campusId)).get(row.programmeId) ?? [];
  const statuses = (await statusesByApplicant([id])).get(id) ?? [];
  const files = new Map(statuses.map((s) => [s.name, s.fileId]));
  return {
    id: row.id, name: row.name, programme: row.programme, batch: row.batch, category: row.category,
    birthDate: row.birthDate, status: row.status, rejectReason: row.rejectReason, parentConsentAt: row.parentConsentAt,
    guardianName: row.guardianName, guardianPhone: row.guardianPhone, guardianEmail: row.guardianEmail,
    studentId: row.studentId, rollNo: row.rollNo,
    checklist: checklist(applicableDocs(docs, row.category), statuses).map((i) => ({ ...i, fileId: files.get(i.name) ?? null })),
  };
}

async function requiredDocsByProgramme(campusId: number) {
  const docs = await db.select({
    programmeId: requiredDocument.programmeId, name: requiredDocument.name, categories: requiredDocument.categories,
  }).from(requiredDocument)
    .innerJoin(programme, eq(requiredDocument.programmeId, programme.id))
    .where(eq(programme.campusId, campusId));
  const byProgramme = new Map<number, { name: string; categories: string[] | null }[]>();
  for (const d of docs) {
    byProgramme.set(d.programmeId, [...(byProgramme.get(d.programmeId) ?? []), { name: d.name, categories: d.categories }]);
  }
  return byProgramme;
}

async function statusesByApplicant(ids: number[]) {
  const byApplicant = new Map<number, (DocState & { fileId: number | null })[]>();
  if (ids.length === 0) return byApplicant;
  const docs = await db.select({
    applicantId: applicantDocument.applicantId, name: applicantDocument.name, status: applicantDocument.status, fileId: applicantDocument.fileId,
  }).from(applicantDocument).where(inArray(applicantDocument.applicantId, ids));
  for (const d of docs) {
    byApplicant.set(d.applicantId, [...(byApplicant.get(d.applicantId) ?? []), { name: d.name, status: d.status, fileId: d.fileId }]);
  }
  return byApplicant;
}
