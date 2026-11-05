import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkUpload } from "@/domain/documents";
import { getViewer } from "@/server/access";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { applicant, applicantDocument, documentFile, programme } from "@/server/schema";
import { can } from "@/domain/roles";

const pick = z.coerce.number().int().positive();

export async function POST(req: Request) {
  const v = await getViewer();
  if (!v) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  if (!can(v.role, "admissions")) return NextResponse.json({ error: "Admissions staff only" }, { status: 403 });

  const fd = await req.formData();
  const id = pick.safeParse(fd.get("applicantId"));
  if (!id.success) return NextResponse.json({ error: "Pick an applicant." }, { status: 400 });
  const name = z.string().trim().min(1, "Pick a document.").safeParse(fd.get("name"));
  if (!name.success) return NextResponse.json({ error: name.error.issues[0].message }, { status: 400 });
  const file = fd.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file." }, { status: 400 });

  const [app] = await db.select({ id: applicant.id, status: applicant.status }).from(applicant)
    .innerJoin(programme, eq(applicant.programmeId, programme.id))
    .where(and(eq(applicant.id, id.data), eq(programme.campusId, v.campusId)));
  if (!app) return NextResponse.json({ error: "Applicant not found on this campus." }, { status: 404 });
  if (app.status !== "applied") {
    return NextResponse.json({ error: "Documents can only change while the applicant is applied." }, { status: 409 });
  }

  const problem = checkUpload(file.type, file.size);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");

  await db.transaction(async (tx) => {
    const [old] = await tx.select({ name: applicantDocument.name, status: applicantDocument.status, fileId: applicantDocument.fileId })
      .from(applicantDocument)
      .where(and(eq(applicantDocument.applicantId, id.data), eq(applicantDocument.name, name.data)));
    const [saved] = await tx.insert(documentFile)
      .values({ name: file.name, mime: file.type, size: file.size, data })
      .returning({ id: documentFile.id });
    // Attaching a file marks a pending document received; a verified one stays verified
    const status = old && old.status !== "pending" ? old.status : "received";
    const [row] = await tx.insert(applicantDocument)
      .values({ applicantId: id.data, name: name.data, status, fileId: saved.id })
      .onConflictDoUpdate({
        target: [applicantDocument.applicantId, applicantDocument.name],
        set: { status, fileId: saved.id, updatedAt: new Date() },
      })
      .returning({ name: applicantDocument.name, status: applicantDocument.status, fileId: applicantDocument.fileId });
    await audit(tx, v, {
      action: "applicant.document.file", entity: "applicant", entityId: id.data,
      oldValue: old ?? null, newValue: { ...row, file: file.name, size: file.size },
    });
  });
  revalidatePath("/applicants");
  return NextResponse.json({ ok: true });
}
