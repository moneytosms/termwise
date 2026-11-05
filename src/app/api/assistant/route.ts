import { z } from "zod";
import { getViewer } from "@/server/access";
import { askAssistant } from "@/server/assistant/ask";
import { MODEL_IDS } from "@/server/llm";

const Body = z.object({
  question: z.string().trim().min(3, "Ask in at least 3 characters.").max(500, "Keep the question under 500 characters."),
  model: z.enum(MODEL_IDS).catch(MODEL_IDS[0]),
  effort: z.enum(["low", "medium", "high"]).catch("low"),
  history: z.array(z.object({ question: z.string().max(500), summary: z.string().max(500).optional(), sql: z.string().max(4000).optional() })).max(10).catch([]),
});

/** A route, not a server action, so the chat's Stop button can abort it: req.signal reaches the model call. */
export async function POST(req: Request) {
  const v = await getViewer();
  if (!v) return Response.json({ error: "Sign in again." }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { question, ...opts } = parsed.data;
  return Response.json({ answer: await askAssistant(v, question, { ...opts, signal: req.signal }) });
}
