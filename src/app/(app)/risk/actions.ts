"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/access";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { runDailyJob } from "@/server/jobs/daily";

/** Runs the daily check now for the viewer's campus. */
export async function runDailyCheck(): Promise<{ error?: string; summary?: Awaited<ReturnType<typeof runDailyJob>> }> {
  const v = await requireAdmin();
  try {
    const summary = await runDailyJob(v.campusId, "manual");
    await db.transaction(async (tx) => {
      await audit(tx, v, { action: "job.run", entity: "campus", entityId: v.campusId, newValue: summary });
    });
    revalidatePath("/risk");
    revalidatePath("/messages");
    return { summary };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The check failed." };
  }
}
