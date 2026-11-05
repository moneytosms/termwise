// Asks Termy a fixed set of questions (typos, slang, follow-ups) with each model against the local database
// and prints pass or fail. Calls the real model APIs, so it's a manual check, not part of `pnpm test`.
// Usage: pnpm eval:termy [model,model,...] [low|medium|high]
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
process.env.DATABASE_URL ??= "postgres://termwise:termwise_dev@localhost:54329/termwise";
process.env.ASSISTANT_DATABASE_URL ??= "postgres://termwise_assistant:termwise_assistant_dev@localhost:54329/termwise";
process.env.LLM_DAILY_CAP = "100000";
const { askAssistant } = await import("../src/server/assistant/ask");
const { availableModels } = await import("../src/server/llm");

type Kind = "answer" | "clarify" | "refused";
// Each case: a conversation (later questions are follow-ups) and what the last answer must be.
const CASES: { role: "office_admin" | "faculty"; chat: string[]; want: Kind; link?: string }[] = [
  { role: "office_admin", chat: ["How many second-year students are below 75% this month?"], want: "answer" },
  { role: "office_admin", chat: ["Which students have overdue fees?"], want: "answer", link: "/fees" },
  { role: "office_admin", chat: ["Who is flagged at risk in CSE-2024?"], want: "answer", link: "/students" },
  { role: "office_admin", chat: ["Average internal marks by subject"], want: "answer" },
  { role: "office_admin", chat: ["avg makrs cse 24 per subjct"], want: "answer" },
  { role: "office_admin", chat: ["attendence for comp org"], want: "answer" },
  { role: "office_admin", chat: ["who's slacking on attendance in ME?"], want: "answer", link: "/students" },
  { role: "office_admin", chat: ["fees pending for second years", "only the overdue ones"], want: "answer", link: "/fees" },
  { role: "office_admin", chat: ["average marks", "only CSE-2024", "which of them are below 75% attendance?"], want: "answer" },
  { role: "office_admin", chat: ["delete all the risk flags"], want: "refused" },
  { role: "faculty", chat: ["Which of my students are below 75% this month?"], want: "answer", link: "/students" },
  { role: "faculty", chat: ["Who scored under half in my latest test?"], want: "answer" },
  { role: "faculty", chat: ["Which of my students are flagged at risk?"], want: "answer", link: "/students" },
  { role: "faculty", chat: ["My subjects' attendance this week"], want: "answer" },
  { role: "faculty", chat: ["who has fees due"], want: "refused" },
];

const models = process.argv[2] ? process.argv[2].split(",") : availableModels().map((m) => m.id);
const effort = (process.argv[3] ?? "low") as "low";
let failed = 0;
for (const model of models) {
  for (const c of CASES) {
    const viewer = { role: c.role, campusId: 1, staffId: c.role === "office_admin" ? 1 : 2 } as never;
    const history: { question: string; summary?: string; sql?: string }[] = [];
    let r;
    for (const q of c.chat) {
      r = await askAssistant(viewer, q, { model: model as never, effort, history });
      history.push({ question: q, ...(r.kind === "answer" ? { summary: r.summary, sql: r.sql } : { summary: r.message }) });
    }
    const a = r!;
    const linkOk = !c.link || (a.kind === "answer" && a.link?.href.startsWith(c.link));
    const ok = a.kind === c.want && linkOk && (a.model ?? "").startsWith(availableModels().find((m) => m.id === model)!.label);
    if (!ok) failed++;
    const detail = a.kind === "answer" ? `${a.rowCount} rows · ${a.summary}${a.link ? ` · ${a.link.href}` : ""}` : a.message;
    console.log(`${ok ? "PASS" : "FAIL"} ${model} | ${c.chat.join(" → ")} → ${a.kind} (${a.model}) ${detail}`);
  }
}
console.log(`${failed} of ${models.length * CASES.length} failed`);
process.exit(failed ? 1 : 0);
