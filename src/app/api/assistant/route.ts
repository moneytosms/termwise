import { z } from "zod";
import { getViewer } from "@/server/access";
import { askAssistant, type Asker } from "@/server/assistant/ask";
import { getPortalViewer } from "@/server/portal";
import { MODEL_IDS } from "@/server/llm";

const Body = z.object({
  question: z.string().trim().min(3, "Ask in at least 3 characters.").max(500, "Keep the question under 500 characters."),
  model: z.enum(MODEL_IDS).catch(MODEL_IDS[0]),
  effort: z.enum(["low", "medium", "high"]).catch("low"),
  history: z.array(z.object({ question: z.string().max(500), summary: z.string().max(500).optional(), sql: z.string().max(4000).optional() })).max(10).catch([]),
});

/** A route, not a server action, so the chat's Stop button can abort it: req.signal reaches the model call. */
export async function POST(req: Request) {
  const staff = await getViewer();
  // Students ask about themselves; parents have no Termy.
  const p = staff ? null : await getPortalViewer();
  const v: Asker | null = staff ?? (p?.role === "student" ? { campusId: p.campusId, staffId: 0, studentId: p.studentId, role: "student" } : null);
  if (!v) return Response.json({ error: "Sign in again." }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { question, ...opts } = parsed.data;
  return Response.json({ answer: await askAssistant(v, question, { ...opts, signal: req.signal }) });
}
