import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import type { generateText, LanguageModel } from "ai";
import { sql } from "drizzle-orm";
import { istDate } from "@/domain/attendance";
import { db } from "./db";
import { llmUsage } from "./schema";

export type Effort = "low" | "medium" | "high";

// Models Termy can pick from, best first. A failed call (Google often answers "high demand") falls back
// through the other available models in this order.
const CHOICES = [
  { id: "gpt-oss-120b", label: "GPT-OSS 120B", hint: "Groq · strongest", provider: "groq", model: "openai/gpt-oss-120b" },
  { id: "gpt-oss-20b", label: "GPT-OSS 20B", hint: "Groq · fastest", provider: "groq", model: "openai/gpt-oss-20b" },
  { id: "flash", label: "Gemini 3.8 Flash", hint: "Google · can be busy", provider: "google", model: "gemini-3.8-flash" },
  { id: "lite", label: "Gemini 3.5 Flash Lite", hint: "Google · quick", provider: "google", model: "gemini-3.5-flash-lite" },
] as const;
export type ModelId = (typeof CHOICES)[number]["id"];
export const MODEL_IDS = CHOICES.map((c) => c.id) as [ModelId, ...ModelId[]];
type Choice = (typeof CHOICES)[number];

const hasKey = (p: string) => (p === "groq" ? !!process.env.GROQ_API_KEY : !!process.env.GOOGLE_GENERATIVE_AI_API_KEY);

/** The models this deployment has keys for, for the chat's picker. First is the default. */
export function availableModels() {
  return CHOICES.filter((c) => hasKey(c.provider)).map(({ id, label, hint }) => ({ id, label, hint }));
}

// Effort maps to each family's reasoning knob: Gemini thinking level, GPT-OSS reasoning effort.
type ProviderOptions = Parameters<typeof generateText>[0]["providerOptions"];

function build(c: Choice, effort: Effort): { label: string; model: LanguageModel; providerOptions: ProviderOptions } {
  if (c.provider === "google") return { label: c.label, model: google(c.model), providerOptions: { google: { thinkingConfig: { thinkingLevel: effort } } } };
  return { label: c.label, model: groq(c.model), providerOptions: { groq: { reasoningEffort: effort } } };
}

/** The picked model first, then the other available ones to fall back to. Empty when the pick's key is missing. */
export function chatModels(id: ModelId, effort: Effort) {
  const picked = CHOICES.find((x) => x.id === id);
  if (!picked || !hasKey(picked.provider)) return [];
  return [picked, ...CHOICES.filter((c) => c !== picked && hasKey(c.provider))].map((c) => build(c, effort));
}

/** One env var switches provider. Null when no key is set, so callers use their fallback. */
export function llmModel() {
  const provider = process.env.LLM_PROVIDER ?? "google";
  if (provider === "groq") return process.env.GROQ_API_KEY ? groq("openai/gpt-oss-120b") : null;
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
