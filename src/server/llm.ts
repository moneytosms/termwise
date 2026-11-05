import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { sql } from "drizzle-orm";
import { istDate } from "@/domain/attendance";
import { db } from "./db";
import { llmUsage } from "./schema";

export type Effort = "low" | "medium" | "high";

// Models Termy can pick from. Google often answers "high demand", so a Gemini pick falls back through the others.
const CHOICES = [
  { id: "lite", label: "Gemini 3.5 Flash Lite", hint: "Fastest", provider: "google", model: "gemini-3.5-flash-lite" },
  { id: "flash", label: "Gemini 3.8 Flash", hint: "Smarter, can be busy", provider: "google", model: "gemini-3.8-flash" },
  { id: "llama", label: "Llama 3.3 70B", hint: "Groq", provider: "groq", model: "llama-3.3-70b-versatile" },
] as const;
export type ModelId = (typeof CHOICES)[number]["id"];
export const MODEL_IDS = CHOICES.map((c) => c.id) as [ModelId, ...ModelId[]];

const GEMINI_CHAIN = [
  { label: "Gemini 3.5 Flash Lite", model: "gemini-3.5-flash-lite" },
  { label: "Gemini Flash Lite", model: "gemini-flash-lite-latest" },
  { label: "Gemini 3.8 Flash", model: "gemini-3.8-flash" },
];

const hasKey = (p: string) => (p === "groq" ? !!process.env.GROQ_API_KEY : !!process.env.GOOGLE_GENERATIVE_AI_API_KEY);

/** The models this deployment has keys for, for the chat's picker. */
export function availableModels() {
  return CHOICES.filter((c) => hasKey(c.provider)).map(({ id, label, hint }) => ({ id, label, hint }));
}

/**
 * The picked model first, then fallbacks to try in order, each with provider options for the effort level.
 * Empty when the pick's key is missing.
 */
export function chatModels(id: ModelId, effort: Effort) {
  const c = CHOICES.find((x) => x.id === id);
  if (!c || !hasKey(c.provider)) return [];
  if (c.provider === "groq") return [{ label: c.label, model: groq(c.model), providerOptions: undefined }];
  // Gemini 3 models take a thinking level.
  const providerOptions = { google: { thinkingConfig: { thinkingLevel: effort } } };
  return [{ label: c.label, model: c.model }, ...GEMINI_CHAIN.filter((g) => g.model !== c.model)]
    .map((g) => ({ label: g.label, model: google(g.model), providerOptions }));
}

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
