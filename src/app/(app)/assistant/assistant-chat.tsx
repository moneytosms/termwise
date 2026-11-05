"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState } from "@/components/states";
import type { AssistantAnswer } from "@/server/assistant/ask";
import { askAction } from "./actions";

type Turn = { id: number; question: string; result: AssistantAnswer | { kind: "error" } | null };

const EXAMPLES = [
  "How many second-year students are below 75% this month?",
  "Which students have overdue fees?",
  "Who is flagged at risk in CSE-2024?",
];
const CHECK_FILTERS = "Check the filters. If they're not what you meant, reword the question.";
const FIGURE = /^[-+]?[\d,.]+%?$/;

const cell = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

export function AssistantChat() {
  const [text, setText] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const box = useRef<HTMLInputElement>(null);

  async function ask(question: string, id?: number) {
    if (busy) return;
    const turnId = id ?? ++seq.current;
    setBusy(true);
    setTurns((t) => id === undefined ? [...t, { id: turnId, question, result: null }] : t.map((x) => (x.id === id ? { ...x, result: null } : x)));
    const drop = () => setTurns((t) => t.filter((x) => x.id !== turnId));
    try {
      const r = await askAction(question);
      if (r.error || !r.answer) {
        toast.error(r.error ?? "Couldn't reach the assistant.");
        if (id === undefined) drop();
        else setTurns((t) => t.map((x) => (x.id === id ? { ...x, result: { kind: "error" } } : x)));
        return;
      }
      const answer = r.answer;
      setTurns((t) => t.map((x) => (x.id === turnId ? { ...x, result: answer } : x)));
      if (answer.kind === "answer" || answer.kind === "refused") setText("");
      if (answer.kind === "clarify") box.current?.focus();
    } catch {
      setTurns((t) => t.map((x) => (x.id === turnId ? { ...x, result: { kind: "error" } } : x)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); void ask(text); }} className="flex gap-2">
        <Input ref={box} value={text} onChange={(e) => setText(e.target.value)} maxLength={500}
          aria-label="Question" placeholder="Ask a question" className="h-9" />
        <Button type="submit" disabled={busy}>Ask</Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <Button key={ex} variant="outline" size="sm" disabled={busy} className="h-auto whitespace-normal py-1.5 text-left"
            onClick={() => { setText(ex); void ask(ex); }}>{ex}</Button>
        ))}
      </div>

      <div className="mt-6 space-y-8">
        {turns.length === 0 && <EmptyState title="No questions yet. Ask one above or try an example." />}
        {turns.map((t) => (
          <section key={t.id} aria-label={`Question: ${t.question}`} aria-busy={t.result === null} className="space-y-3">
            <p className="text-sm text-muted-foreground">You asked: {t.question}</p>
            {t.result === null && <Skeleton className="h-40 w-full rounded-xl" />}
            {t.result?.kind === "answer" && <Answer a={t.result} />}
            {t.result?.kind === "clarify" && <Note label="Needs more detail" message={t.result.message} />}
            {t.result?.kind === "refused" && <Note label="Can't answer this" message={t.result.message} />}
            {t.result?.kind === "unavailable" && <ErrorState message={t.result.message} onRetry={() => void ask(t.question, t.id)} />}
            {t.result?.kind === "error" && <ErrorState message="Couldn't reach the assistant." onRetry={() => void ask(t.question, t.id)} />}
          </section>
        ))}
      </div>
    </>
  );
}

function Answer({ a }: { a: Extract<AssistantAnswer, { kind: "answer" }> }) {
  return (
    <div className="space-y-5 rounded-xl bg-card p-4 shadow-sheet">
      <p className="text-lg font-medium leading-snug">{a.summary}</p>

      <div>
        <p className="mb-2 text-xs text-muted-foreground">Filters used</p>
        {a.filters.length ? (
          <div className="flex flex-wrap gap-1.5">
            {a.filters.map((f) => <span key={f} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{f}</span>)}
          </div>
        ) : <p className="text-sm text-muted-foreground">No filters.</p>}
      </div>

      <div>
        <p className="text-xs text-muted-foreground">Row count</p>
        <p className="tabular-nums text-2xl">
          {a.rowCount}
          {a.truncated && <span className="ml-2 font-sans text-sm text-muted-foreground">showing first {a.rows.length}</span>}
        </p>
      </div>

      {a.rowCount === 0 ? (
        <p className="text-sm text-muted-foreground">No rows match these filters.</p>
      ) : (
        <div className="rounded-lg bg-muted/60">
          <Table>
            <TableHeader>
              <TableRow>{a.columns.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {a.rows.map((r, i) => (
                <TableRow key={i}>
                  {a.columns.map((c) => {
                    const v = cell(r[c]);
                    return <TableCell key={c} className={typeof r[c] === "number" || FIGURE.test(v) ? "tabular-nums" : undefined}>{v}</TableCell>;
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <details className="rounded-lg bg-muted/60 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">Query</summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap tabular-nums text-xs">{a.sql}</pre>
      </details>

      <p className="text-xs text-muted-foreground">{CHECK_FILTERS}</p>
    </div>
  );
}

function Note({ label, message }: { label: string; message: string }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-sheet">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}
