import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { campus } from "@/server/schema";
import { runDailyJob } from "@/server/jobs/daily";
import { writeMonthlySnapshots } from "@/server/jobs/snapshot";

/** Called by the host's daily cron with the shared secret. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const campuses = await db.select({ id: campus.id }).from(campus);
  const results = [];
  let snapshots = 0;
  for (const c of campuses) {
    results.push(await runDailyJob(c.id, "schedule"));
    snapshots += await writeMonthlySnapshots(c.id);
  }
  return NextResponse.json({ results, snapshots });
}
