"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireViewer } from "@/server/access";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { mentorTask, riskFlag } from "@/server/schema";

/** Only the assigned mentor closes their own task. */
export async function closeMentorTask(taskId: number, status: "done" | "dismissed"): Promise<{ error?: string }> {
  const v = await requireViewer();
  if (status !== "done" && status !== "dismissed") return { error: "Invalid status." };
  const [row] = await db.select({ studentId: riskFlag.studentId, old: mentorTask.status }).from(mentorTask)
    .innerJoin(riskFlag, eq(mentorTask.flagId, riskFlag.id))
    .where(and(eq(mentorTask.id, taskId), eq(mentorTask.mentorId, v.staffId)));
  if (!row) return { error: "This task isn't yours." };
  await db.transaction(async (tx) => {
    await tx.update(mentorTask).set({ status, closedAt: new Date() }).where(eq(mentorTask.id, taskId));
    await audit(tx, v, { action: "mentor_task.close", entity: "student", entityId: row.studentId, oldValue: { status: row.old }, newValue: { status } });
  });
  revalidatePath("/students");
  return {};
}
