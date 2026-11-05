import { Pool } from "pg";
import { pool } from "@/server/db";

export const dynamic = "force-dynamic";

// Names only, never values: lets anyone check a deploy is configured without exposing secrets.
const REQUIRED = ["DATABASE_URL", "ASSISTANT_DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "CRON_SECRET"];
const OPTIONAL = ["GOOGLE_GENERATIVE_AI_API_KEY", "GROQ_API_KEY", "LLM_PROVIDER", "LLM_DAILY_CAP"];
const assistant = new Pool({ connectionString: process.env.ASSISTANT_DATABASE_URL, max: 1 });

async function ping(p: Pool) {
  try { await p.query("select 1"); return true; } catch { return false; }
}

/** Render's health check: 503 while the database is unreachable, so a broken deploy never takes traffic. */
export async function GET() {
  const set = (k: string) => !!process.env[k];
  const [db, assistantDb] = await Promise.all([ping(pool), ping(assistant)]);
  const env = Object.fromEntries([...REQUIRED, ...OPTIONAL].map((k) => [k, set(k)]));
  const missing = REQUIRED.filter((k) => !set(k));
  const ok = db && missing.length === 0;
  return Response.json({ ok, db, assistantDb, llm: set("GOOGLE_GENERATIVE_AI_API_KEY") || set("GROQ_API_KEY"), missing, env }, { status: ok ? 200 : 503 });
}
