"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, Check, Code2, Copy, Download, History, RotateCcw, Square, SquarePen, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SelectField } from "@/components/select-field";
import { Termy, type TermyPose } from "@/components/termy";
import { cn } from "@/lib/utils";
import type { AssistantAnswer } from "@/server/assistant/ask";

type Result = AssistantAnswer | { kind: "error" | "stopped"; model?: string };
type Turn = { id: number; question: string; result: Result | null };
type Chat = { id: string; title: string; turns: Turn[]; at: number };
type Effort = "low" | "medium" | "high";
export type ModelOption = { id: string; label: string; hint: string };

const ASKS = {
  office_admin: "students, attendance, marks and fees", faculty: "students, attendance, marks",
  admissions: "students", exams: "students and marks", accounts: "students and fees",
};

const EXAMPLES = {
  office_admin: [
    "How many second-year students are below 75% this month?",
    "Which students have overdue fees?",
    "Who is flagged at risk in CSE-2024?",
    "Average internal marks by subject",
  ],
  faculty: [
    "Which of my students are below 75% this month?",
    "Who scored under half in my latest test?",
    "Which of my students are flagged at risk?",
    "My subjects' attendance this week",
  ],
  admissions: [
    "How many students are in each batch?",
    "List the first-year students in CSE-2024",
    "How many students per programme?",
    "Find the student named Priya",
  ],
  exams: [
    "Average internal marks by subject",
    "Who scored under half in the latest test?",
    "Which subjects still have draft marks?",
    "Top five students by total marks in CSE-2024",
  ],
  accounts: [
    "Which students have overdue fees?",
    "How much is due in CSE-2024?",
    "Total fee dues by programme",
    "Students with more than 50000 due",
  ],
  hr: [] as string[],
  student: [
    "Which subjects am I below 75% in?",
    "My attendance this month by subject",
    "My mid-term marks in every subject",
    "How much fee do I still owe?",
  ],
};
const EFFORTS: { id: Effort; label: string; hint: string }[] = [
  { id: "low", label: "Quick", hint: "Fast answers for simple lookups" },
  { id: "medium", label: "Balanced", hint: "More thought for multi-step questions" },
  { id: "high", label: "Deep", hint: "Slowest; for tricky comparisons" },
];
const POSE: Record<Result["kind"], TermyPose> = { answer: "answer", clarify: "idle", refused: "refused", unavailable: "error", error: "error", stopped: "idle" };
const PREFS = "termwise:termy";
const MAX_CHATS = 20;
const FIGURE = /^[-+]?[\d,.]+%?$/;
const cell = (v: unknown) => (v === null || v === undefined ? "–" : typeof v === "object" ? JSON.stringify(v) : String(v));
const newId = () => Math.random().toString(36).slice(2, 10);

function load<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; }
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full or blocked: chat still works, just not kept */ }
}

export function AssistantChat({ role, userId, models, initial }: { role: keyof typeof EXAMPLES; userId: string; models: ModelOption[]; initial?: string }) {
  const CHATS = `termwise:termy-chats:${userId}`;
  const [text, setText] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatId, setChatId] = useState(newId);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState({ model: models[0]?.id ?? "", effort: "low" as Effort });
  const seq = useRef(0);
  const ctrl = useRef<AbortController | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  // localStorage is client-only, so prefs and saved chats load after mount.
  useEffect(() => {
    const p = load<{ model?: string; effort?: Effort }>(PREFS, {});
    setPrefs({ model: models.some((m) => m.id === p.model) ? p.model! : models[0]?.id ?? "", effort: EFFORTS.some((e) => e.id === p.effort) ? p.effort! : "low" }); // eslint-disable-line react-hooks/set-state-in-effect
    setChats(load<Chat[]>(CHATS, []));
  }, [models, CHATS]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns]);
  // "Ask Termy" links elsewhere arrive as /assistant?q=...
  useEffect(() => { if (initial && !asked.current) { asked.current = true; void ask(initial); } });
  useEffect(() => {
    if (!busy) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") stop(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy]);
  useEffect(() => () => ctrl.current?.abort(), []);

  // Keep the current chat in the saved list once it has a settled turn.
  useEffect(() => {
    const settled = turns.filter((t) => t.result !== null);
    if (!settled.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors turns into the saved list and localStorage
    setChats((cs) => {
      const next = [{ id: chatId, title: settled[0].question, turns: settled, at: Date.now() }, ...cs.filter((c) => c.id !== chatId)].slice(0, MAX_CHATS);
      save(CHATS, next);
      return next;
    });
  }, [turns, chatId, CHATS]);

  function pick(next: Partial<typeof prefs>) {
    const p = { ...prefs, ...next };
    setPrefs(p);
    save(PREFS, p);
  }

  function stop() { ctrl.current?.abort(); }

  function open(c: Chat | null) {
    stop();
    setTurns(c?.turns ?? []);
    setChatId(c?.id ?? newId());
    seq.current = Math.max(0, ...(c?.turns ?? []).map((t) => t.id));
    setText("");
    box.current?.focus();
  }

  function remove(id: string) {
    setChats((cs) => { const next = cs.filter((c) => c.id !== id); save(CHATS, next); return next; });
    if (id === chatId) open(null);
  }

  async function ask(question: string, retryId?: number) {
    const q = question.trim();
    if (busy || q.length < 3) return;
    const id = retryId ?? ++seq.current;
    // Earlier answered turns give follow-ups ("only CSE") their context.
    const history = turns.filter((t) => t.id !== id && t.result?.kind === "answer").map((t) => {
      const a = t.result as Extract<AssistantAnswer, { kind: "answer" }>;
      return { question: t.question, summary: a.summary, sql: a.sql };
    });
    const c = new AbortController();
    ctrl.current = c;
    setBusy(true);
    setTurns((ts) => (retryId === undefined ? [...ts, { id, question: q, result: null }] : ts.map((t) => (t.id === id ? { ...t, result: null } : t))));
    if (retryId === undefined) setText("");
    const settle = (result: Result) => setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, result } : t)));
    try {
      const res = await fetch("/api/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: c.signal,
        body: JSON.stringify({ question: q, ...prefs, history }),
      });
      const r = (await res.json()) as { error?: string; answer?: AssistantAnswer };
      if (r.error || !r.answer) {
        toast.error(r.error ?? "Couldn't reach Termy.");
        setTurns((ts) => ts.filter((t) => t.id !== id));
        if (retryId === undefined) setText(q);
        return;
      }
      settle(r.answer);
    } catch {
      settle({ kind: c.signal.aborted ? "stopped" : "error" });
    } finally {
      if (ctrl.current === c) ctrl.current = null;
      setBusy(false);
      box.current?.focus();
    }
  }

  const current = models.find((m) => m.id === prefs.model);
  const list = (
    <ChatList chats={chats} current={chatId} onOpen={open} onDelete={remove} />
  );

  return (
    <div className="flex h-[calc(100dvh-10rem-env(safe-area-inset-bottom))] overflow-hidden rounded-2xl bg-card shadow-sheet md:h-[calc(100dvh-4rem)]">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-rule lg:flex" aria-label="Chats">
        <div className="p-3"><Button variant="outline" className="w-full justify-start" onClick={() => open(null)}><SquarePen className="size-4" aria-hidden />New chat</Button></div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">{list}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-rule px-4 py-3">
        <Termy pose={busy ? "thinking" : "idle"} className="size-9" />
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold leading-tight">Termy</h1>
          <p className="truncate text-xs text-muted-foreground">
            {role === "faculty" ? "Only the subjects you teach" : role === "student" ? "Only your own records" : role === "hr" ? "Nothing to query for HR yet" : "Your whole campus"} · reads data, never changes it
          </p>
        </div>
        <Popover>
          <PopoverTrigger render={<Button variant="ghost" size="sm" className="lg:hidden" />}><History className="size-4" aria-hidden />Chats</PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-2">{list}</PopoverContent>
        </Popover>
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => open(null)}><SquarePen className="size-4" aria-hidden />New</Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5" aria-live="polite">
        {turns.length === 0 ? (
          <div className="mx-auto flex max-w-xl flex-col items-center pt-6 text-center md:pt-12">
            <Termy className="size-24 md:size-28" />
            <p className="mt-3 text-xl font-semibold">Hi, I&apos;m Termy.</p>
            <p className="mt-1 text-sm text-muted-foreground">{role === "student" ? "Ask about your attendance, marks and fees" : role === "hr" ? "Termy has no data views for HR" : <>Ask about {ASKS[role as Exclude<typeof role, "student" | "hr">]}</>} in plain words. I show the filters and query I used, so you can check them.</p>
            <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
              {EXAMPLES[role].map((ex) => (
                <button key={ex} type="button" disabled={busy} onClick={() => void ask(ex)}
                  className="rounded-xl bg-muted/60 px-3.5 py-3 text-left text-sm transition-colors hover:bg-muted active:bg-secondary">{ex}</button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="mx-auto max-w-3xl space-y-6">
            {turns.map((t) => (
              <li key={t.id} className="space-y-3">
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-3.5 py-2 text-sm whitespace-pre-wrap text-background">{t.question}</p>
                </div>
                <div className="flex items-start gap-2.5" aria-busy={t.result === null}>
                  <Termy pose={t.result === null ? "thinking" : POSE[t.result.kind]} className="mt-0.5 size-8 shrink-0" />
                  <div className="min-w-0 flex-1">
                    {t.result === null ? <Typing /> : <Reply r={t.result} onRetry={() => void ask(t.question, t.id)} />}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void ask(text); }} className="shrink-0 border-t border-rule p-3">
        <div className="mx-auto max-w-3xl rounded-xl bg-background p-2 shadow-field focus-within:ring-3 focus-within:ring-ring/30">
          <textarea ref={box} value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={500}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!busy) void ask(text); } }}
            aria-label="Ask Termy" placeholder={turns.length ? "Ask a follow-up, like “only CSE-2024”" : "Ask Termy a question"}
            className="field-sizing-content max-h-40 min-h-10 w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground" />
          <div className="flex flex-wrap items-center gap-2">
            {models.length > 1 && (
              <SelectField aria-label="Model" size="sm" className="h-8 min-w-0 text-xs" value={prefs.model}
                options={models.map((m) => ({ value: m.id, label: m.label }))} onValueChange={(v) => pick({ model: v })} />
            )}
            <div role="radiogroup" aria-label="Effort" className="inline-flex rounded-lg bg-secondary p-0.5 text-xs font-medium">
              {EFFORTS.map((e) => (
                <button key={e.id} type="button" role="radio" aria-checked={prefs.effort === e.id} title={e.hint} onClick={() => pick({ effort: e.id })}
                  className={cn("h-7 rounded-md px-2.5 transition-colors", prefs.effort === e.id ? "bg-card text-foreground shadow-sheet" : "text-muted-foreground hover:text-foreground")}>{e.label}</button>
              ))}
            </div>
            <span className="hidden flex-1 truncate text-xs text-muted-foreground sm:block">{current?.hint}{current && " · "}Enter to send, Shift+Enter for a new line</span>
            <span className="flex-1 sm:hidden" />
            {busy
              ? <Button type="button" size="icon-sm" variant="outline" onClick={stop} aria-label="Stop" title="Stop (Esc)"><Square className="fill-current" /></Button>
              : <Button type="submit" size="icon-sm" disabled={text.trim().length < 3} aria-label="Send"><ArrowUp /></Button>}
          </div>
        </div>
      </form>
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md bg-muted/70 px-3.5 py-3" aria-label="Termy is thinking">
      {[0, 150, 300].map((d) => <span key={d} className="termy-dot size-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: `${d}ms` }} />)}
    </div>
  );
}

function Bubble({ children, tone, alert }: { children: React.ReactNode; tone?: "warn"; alert?: boolean }) {
  return <div role={alert ? "alert" : undefined} className={cn("rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm", tone === "warn" ? "bg-late-soft" : "bg-muted/70")}>{children}</div>;
}

function Reply({ r, onRetry }: { r: Result; onRetry: () => void }) {
  const meta = r.model && <p className="mt-1.5 text-[11px] text-muted-foreground">{r.model}</p>;
  if (r.kind === "answer") return <><Answer a={r} />{meta}</>;
  if (r.kind === "clarify") return <><Bubble>{r.message}</Bubble>{meta}</>;
  if (r.kind === "refused") return <><Bubble tone="warn">{r.message}</Bubble>{meta}</>;
  if (r.kind === "stopped") return (
    <Bubble>
      <p className="text-muted-foreground">Stopped.</p>
      <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}><RotateCcw className="size-3.5" aria-hidden />Ask again</Button>
    </Bubble>
  );
  return (
    <Bubble tone="warn" alert>
      <p>{r.kind === "unavailable" ? r.message : "Couldn't reach Termy."}</p>
      <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}><RotateCcw className="size-3.5" aria-hidden />Try again</Button>
    </Bubble>
  );
}

function Answer({ a }: { a: Extract<AssistantAnswer, { kind: "answer" }> }) {
  const [sql, setSql] = useState(false);
  const [copied, setCopied] = useState(false);
  // One number (a count or an average) reads better as a figure than as a one-cell table.
  const single = a.rowCount === 1 && a.columns.length === 1 ? cell(a.rows[0][a.columns[0]]) : null;

  function csv() {
    const q = (v: unknown) => `"${cell(v).replaceAll('"', '""')}"`;
    const body = [a.columns.map(q).join(","), ...a.rows.map((r) => a.columns.map((c) => q(r[c])).join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    link.download = "termy-answer.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="space-y-2.5">
      <Bubble>
        <p className="leading-relaxed">{a.summary}</p>
        {a.filters.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Filters used">
            {a.filters.map((f) => <span key={f} className="rounded-full bg-card px-2 py-0.5 text-xs shadow-sheet">{f}</span>)}
          </div>
        )}
      </Bubble>

      {single !== null ? (
        <div className="inline-block rounded-xl bg-card px-4 py-3 shadow-sheet">
          <p className="text-xs text-muted-foreground">{a.columns[0]}</p>
          <p className="text-3xl font-medium tabular-nums">{single}</p>
        </div>
      ) : a.rowCount === 0 ? (
        <p className="text-sm text-muted-foreground">No rows match these filters.</p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card shadow-sheet">
          <div className="max-h-80 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>{a.columns.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow>
              </TableHeader>
              <TableBody>
                {a.rows.map((r, i) => (
                  <TableRow key={i}>
                    {a.columns.map((c) => {
                      const v = cell(r[c]);
                      return <TableCell key={c} className={cn("whitespace-nowrap", (typeof r[c] === "number" || FIGURE.test(v)) && "text-right tabular-nums")}>{v}</TableCell>;
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="border-t border-rule px-3 py-2 text-xs text-muted-foreground tabular-nums">
            {a.rowCount} {a.rowCount === 1 ? "row" : "rows"}{a.truncated && `, showing first ${a.rows.length}`}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {a.link && <Button variant="outline" size="sm" className="h-7 text-xs" nativeButton={false} render={<Link href={a.link.href} />}>{a.link.label}<ArrowRight className="size-3.5" aria-hidden /></Button>}
        <Button variant="ghost" size="sm" className="h-7 text-xs" aria-expanded={sql} onClick={() => setSql(!sql)}><Code2 className="size-3.5" aria-hidden />{sql ? "Hide query" : "Show query"}</Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { void navigator.clipboard.writeText(a.sql); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}{copied ? "Copied" : "Copy SQL"}
        </Button>
        {a.rowCount > 0 && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={csv}><Download className="size-3.5" aria-hidden />CSV</Button>}
      </div>
      {sql && <pre className="overflow-x-auto rounded-xl bg-muted/70 p-3 font-code text-xs whitespace-pre-wrap">{a.sql}</pre>}
    </div>
  );
}

function ChatList({ chats, current, onOpen, onDelete }: { chats: Chat[]; current: string; onOpen: (c: Chat) => void; onDelete: (id: string) => void }) {
  if (!chats.length) return <p className="px-2 py-3 text-xs text-muted-foreground">Past chats on this device show here.</p>;
  return (
    <ul className="space-y-0.5">
      {chats.map((c) => (
        <li key={c.id} className="group flex items-center">
          <button type="button" onClick={() => onOpen(c)} aria-current={c.id === current || undefined}
            className={cn("min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted", c.id === current && "bg-muted font-medium")}>{c.title}</button>
          <button type="button" onClick={() => onDelete(c.id)} aria-label={`Delete chat: ${c.title}`}
            className="ml-0.5 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 max-lg:opacity-100"><Trash2 className="size-3.5" /></button>
        </li>
      ))}
    </ul>
  );
}
