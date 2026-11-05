import { NextResponse } from "next/server";
import { studentResults } from "@/app/(portal)/my/marks/queries";
import { getPortalViewer } from "@/server/portal";

export async function GET() {
  const v = await getPortalViewer();
  if (!v) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  const rows = await studentResults(v.studentId);
  return NextResponse.json(rows, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } });
}
