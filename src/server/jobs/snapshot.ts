import { istDate } from "@/domain/attendance";
import { previousMonth } from "@/domain/reports";
import { runReport } from "@/app/(app)/reports/queries";
import { db } from "../db";
import { reportSnapshot } from "../schema";

/** The standard reports the snapshot table's enum holds; the AICTE pack is not snapshotted. */
const SNAPSHOT_KEYS = ["strength", "shortage", "marks", "fees"] as const;

/** Stores each standard report for last month, once. Re-runs leave existing snapshots alone. Returns rows written. */
export async function writeMonthlySnapshots(campusId: number, today: string = istDate()) {
  const month = previousMonth(today);
  let written = 0;
  for (const report of SNAPSHOT_KEYS) {
    const { rows } = await runReport({ campusId }, report, { month, today });
    const inserted = await db.insert(reportSnapshot)
      .values({ campusId, month, report, rows })
      .onConflictDoNothing()
      .returning({ id: reportSnapshot.id });
    written += inserted.length;
  }
  return written;
}
