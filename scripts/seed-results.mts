import { and, eq, notExists, sql } from "drizzle-orm";
import { db } from "../src/server/db";
import * as t from "../src/server/schema";
import { writeResults } from "../src/server/results";

// Idempotent backfill: results for locked subjects that have none yet (existing databases, or locks made before results existed).
export async function seedResults() {
  const missing = await db.select({ id: t.subject.id }).from(t.subject)
    .where(and(
      eq(t.subject.marksStatus, "locked"),
      notExists(db.select({ one: sql`1` }).from(t.result).where(eq(t.result.subjectId, t.subject.id))),
    ));
  for (const s of missing) await db.transaction((tx) => writeResults(tx, s.id));
}
