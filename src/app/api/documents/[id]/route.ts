import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertStudentAccess, getViewer, type Viewer } from "@/server/access";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getPortalViewer } from "@/server/portal";
import { applicant, applicantDocument, documentFile, programme, studentDocument } from "@/server/schema";
import { can } from "@/domain/roles";

/** Staff may open applicant files on their campus and student files they may see. */
async function staffCanRead(v: Viewer, fileId: number) {
  if (can(v.role, "admissions")) {
    const [row] = await db.select({ id: applicantDocument.id }).from(applicantDocument)
      .innerJoin(applicant, eq(applicantDocument.applicantId, applicant.id))
      .innerJoin(programme, eq(applicant.programmeId, programme.id))
      .where(and(eq(applicantDocument.fileId, fileId), eq(programme.campusId, v.campusId)));
    if (row) return true;
  }
  const [sd] = await db.select({ studentId: studentDocument.studentId }).from(studentDocument)
    .where(eq(studentDocument.fileId, fileId));
  if (!sd) return false;
  try {
    await assertStudentAccess(v, sd.studentId);
    return true;
  } catch {
    return false;
  }
}

/** Portal users may open the files of their active student only. */
async function portalCanRead(studentId: number, fileId: number) {
  const [sd] = await db.select({ studentId: studentDocument.studentId }).from(studentDocument)
    .where(eq(studentDocument.fileId, fileId));
  return !!sd && sd.studentId === studentId;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.coerce.number().int().positive().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const v = await getViewer();
  const p = v ? null : await getPortalViewer();
  const allowed = v ? await staffCanRead(v, id.data) : p ? await portalCanRead(p.studentId, id.data) : false;
  if (!allowed) {
    const signedIn = await auth.api.getSession({ headers: await headers() });
    return NextResponse.json({ error: signedIn ? "Not allowed." : "signed_out" }, { status: signedIn ? 403 : 401 });
  }

  const [file] = await db.select().from(documentFile).where(eq(documentFile.id, id.data));
  if (!file) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const safe = file.name.replace(/[^\w.\- ]/g, "_");
  return new Response(Buffer.from(file.data, "base64"), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `inline; filename="${safe}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
