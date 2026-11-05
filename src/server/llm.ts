import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { sql } from "drizzle-orm";
import { istDate } from "@/domain/attendance";
import { db } from "./db";
import { llmUsage } from "./schema";

/** One env var switches provider. Null when no key is set, so callers use their fallback. */
export function llmModel() {
  const provider = process.env.LLM_PROVIDER ?? "google";
  if (provider === "groq") return process.env.GROQ_API_KEY ? groq("llama-3.3-70b-versatile") : null;
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY ? google("gemini-3.8-flash") : null;
}

/** Counts one call against the daily cap; false once the cap is reached. */
export async function takeLlmQuota(): Promise<boolean> {
  const cap = Number(process.env.LLM_DAILY_CAP ?? 200);
  const [row] = await db.insert(llmUsage).values({ day: istDate(), count: 1 })
    .onConflictDoUpdate({ target: llmUsage.day, set: { count: sql`${llmUsage.count} + 1` } })
    .returning({ count: llmUsage.count });
  return row.count <= cap;
}
