"use server";

import { z } from "zod";
import { requireAdmin } from "@/server/access";
import { askAssistant, type AssistantAnswer } from "@/server/assistant/ask";

const question = z.string().trim().min(3, "Ask in at least 3 characters.").max(500, "Keep the question under 500 characters.");

export async function askAction(input: string): Promise<{ error?: string; answer?: AssistantAnswer }> {
  const v = await requireAdmin();
  const parsed = question.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return { answer: await askAssistant(v, parsed.data) };
}
