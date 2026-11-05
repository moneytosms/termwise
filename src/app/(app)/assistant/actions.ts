"use server";

import { z } from "zod";
import { requireViewer } from "@/server/access";
import { askAssistant, type AssistantAnswer } from "@/server/assistant/ask";
import { MODEL_IDS } from "@/server/llm";

const question = z.string().trim().min(3, "Ask in at least 3 characters.").max(500, "Keep the question under 500 characters.");

const opts = z.object({
  model: z.enum(MODEL_IDS).catch("lite"),
  effort: z.enum(["low", "medium", "high"]).catch("low"),
  history: z.array(z.object({ question: z.string().max(500), summary: z.string().max(500).optional(), sql: z.string().max(4000).optional() })).max(10).catch([]),
});

export async function askAction(input: string, options?: unknown): Promise<{ error?: string; answer?: AssistantAnswer }> {
  const v = await requireViewer();
  const parsed = question.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return { answer: await askAssistant(v, parsed.data, opts.parse(options ?? {})) };
}
