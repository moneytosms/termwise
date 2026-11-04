import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { assertSubjectAccess, getViewer } from "@/server/access";
import { db } from "@/server/db";
import { attendanceEntry, attendanceSession } from "@/server/schema";

/** A saved session's statuses, for editing it. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer();
  if (!v) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  const { id } = await params;
  const [s] = await db.select().from(attendanceSession).where(eq(attendanceSession.id, id));
  if (!s) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try { await assertSubjectAccess(v, s.subjectId); } catch { return NextResponse.json({ error: "forbidden" }, { status: 403 }); }
  const entries = await db.select({ studentId: attendanceEntry.studentId, status: attendanceEntry.status }).from(attendanceEntry).where(eq(attendanceEntry.sessionId, id));
  return NextResponse.json({ entries });
}
