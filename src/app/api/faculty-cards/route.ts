import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getViewer } from "@/server/access";
import { db } from "@/server/db";
import { mentorTask, subject } from "@/server/schema";

export async function GET() {
  const v = await getViewer();
  if (!v) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  const [marks] = await db.select({ n: count() }).from(subject).where(and(eq(subject.facultyId, v.staffId), eq(subject.marksStatus, "draft")));
  const [tasks] = await db.select({ n: count() }).from(mentorTask).where(and(eq(mentorTask.mentorId, v.staffId), eq(mentorTask.status, "open")));
  return NextResponse.json({ marksDue: marks.n, openTasks: tasks.n });
}
