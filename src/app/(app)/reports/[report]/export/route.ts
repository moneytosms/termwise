import { NextResponse } from "next/server";
import { istDate } from "@/domain/attendance";
import { REPORT_CAP, REPORT_KEYS, toCsv, type ReportKey } from "@/domain/reports";
import { getViewer } from "@/server/access";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { runReport } from "../../queries";
import { can } from "@/domain/roles";

export async function GET(req: Request, { params }: { params: Promise<{ report: string }> }) {
  const v = await getViewer();
  if (!v) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  const { report } = await params;
  if (!(REPORT_KEYS as readonly string[]).includes(report)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(v.role, REPORT_CAP[report as ReportKey])) return NextResponse.json({ error: "Not allowed for your role" }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const month = sp.get("month") || istDate().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: "month must be YYYY-MM." }, { status: 400 });
  const programmeParam = sp.get("programme");
  if (programmeParam && !/^\d+$/.test(programmeParam)) return NextResponse.json({ error: "programme must be a number." }, { status: 400 });
  const programmeId = programmeParam ? Number(programmeParam) : null;

  const key = report as ReportKey;
  const { columns, rows } = await runReport(v, key, { month, programmeId });
  await db.transaction(async (tx) => {
    await audit(tx, v, { action: "reports.export", entity: "campus", entityId: v.campusId, newValue: { report: key, month, programmeId, count: rows.length } });
  });
  return new Response(toCsv(columns, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${key}-${month}.csv"`,
    },
  });
}
