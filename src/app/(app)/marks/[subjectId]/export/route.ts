import { NextResponse } from "next/server";
import { universityCsv } from "@/domain/marks";
import { AccessError, getViewer } from "@/server/access";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { getSheet } from "../../queries";

export async function GET(_req: Request, { params }: { params: Promise<{ subjectId: string }> }) {
  const v = await getViewer();
  if (!v) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  if (v.role !== "office_admin") return NextResponse.json({ error: "Office admin only" }, { status: 403 });
  const { subjectId } = await params;
  if (!/^\d+$/.test(subjectId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let sheet;
  try {
    sheet = await getSheet(v, Number(subjectId));
  } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
  if (sheet.subject.status !== "locked") return NextResponse.json({ error: "Lock the marks before exporting." }, { status: 409 });

  const csv = universityCsv(sheet.subject.code, sheet.components, sheet.students, sheet.marks);
  await db.transaction(async (tx) => {
    await audit(tx, v, { action: "marks.export", entity: "subject", entityId: sheet.subject.id });
  });
  const file = `${sheet.subject.code.replace(/[^\w-]/g, "_")}-marks.csv`;
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}"` },
  });
}
