"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { RegisterSheet } from "@/components/register-sheet";
import { StatusPill } from "@/components/page";
import { cn } from "@/lib/utils";

const INTERVAL_MS = 3500;
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(cb: () => void) {
  const mq = matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function Shortage() {
  const rows = [["Asha K.", 92], ["Ravi M.", 81], ["Sneha P.", 74], ["Dev T.", 58]] as const;
  return (
    <div className="max-w-lg space-y-3 rounded-xl bg-card p-4 text-xs shadow-float">
      {rows.map(([name, pct]) => (
        <div key={name} className="flex items-center gap-3">
          <span className="w-16 shrink-0 truncate">{name}</span>
          <div className="relative h-2 flex-1 rounded-full bg-secondary">
            <span className={cn("absolute inset-y-0 left-0 rounded-full", pct < 75 ? "bg-absent" : "bg-data")} style={{ width: `${pct}%` }} />
            <span className="absolute -inset-y-1 left-[75%] w-px bg-foreground/60" />
          </div>
          <span className="w-9 text-right tabular-nums">{pct}%</span>
        </div>
      ))}
      <p className="flex items-center gap-2 text-muted-foreground"><span className="h-3 w-px bg-foreground/60" />75% minimum</p>
    </div>
  );
}

function FeeReminder() {
  return (
    <div className="max-w-lg space-y-3 rounded-xl bg-card p-4 text-sm shadow-float">
      <div className="rounded-lg bg-muted p-3">
        <p className="text-xs text-muted-foreground">English</p>
        <p className="mt-1">Fee reminder: ₹4,500 is due. Please pay at the bank counter.</p>
      </div>
      <div className="rounded-lg bg-muted p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Odia</p>
          <StatusPill tone="late">Needs native review</StatusPill>
        </div>
        <p className="mt-1">ଶୁଳ୍କ ସ୍ମାରକ: ₹୪,୫୦୦ ବକେୟା ଅଛି। ଦୟାକରି ବ୍ୟାଙ୍କ କାଉଣ୍ଟରରେ ପଇଠ କରନ୍ତୁ।</p>
      </div>
    </div>
  );
}

function MarksFlow() {
  const steps = [["Draft", "bg-secondary text-muted-foreground"], ["Submitted", "bg-data-soft text-data"], ["Locked", "bg-primary text-primary-foreground"]] as const;
  return (
    <div className="max-w-lg space-y-4 rounded-xl bg-card p-4 text-xs shadow-float">
      <p className="text-sm font-medium">Computer Organisation · Mid-sem</p>
      <ol className="flex items-center gap-2 font-medium">
        {steps.map(([label, tone], i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span className={cn("flex-1 rounded-md px-2.5 py-1.5 text-center", tone)}>{label}</span>
            {i < steps.length - 1 && <span aria-hidden className="text-muted-foreground">→</span>}
          </li>
        ))}
      </ol>
      <p className="text-muted-foreground">Reopening a locked sheet needs a reason. Every step is audited.</p>
    </div>
  );
}

function RiskTask() {
  return (
    <div className="max-w-lg space-y-3 rounded-xl bg-card p-4 text-sm shadow-float">
      <div className="flex items-center justify-between rounded-lg bg-absent-soft px-3 py-2.5">
        <span>Dev T.</span>
        <span className="text-xs font-medium text-absent">Attendance 58%</span>
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5">
        <span aria-hidden className="mt-0.5 size-4 shrink-0 rounded border border-border" />
        <div>
          <p>Follow up with Dev T.</p>
          <p className="text-xs text-muted-foreground">Mentor task · open</p>
        </div>
      </div>
    </div>
  );
}

function AskAssistant() {
  return (
    <div className="max-w-lg space-y-3 rounded-xl bg-card p-4 text-sm shadow-float">
      <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground">Who has fees due this week?</p>
      <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2">Three students: Asha K., Dev T. and Ravi M. Read only, nothing was changed.</p>
    </div>
  );
}

const SLIDES: { title: string; copy: string; visual: ReactNode }[] = [
  { title: "Attendance in class, even with no signal.", copy: "Everyone starts present; one tap per absentee. It syncs later and never overwrites another teacher’s sheet.", visual: <RegisterSheet /> },
  { title: "Shortage alerts before it’s too late.", copy: "Students drifting toward the 75% line are flagged while there is still time to act.", visual: <Shortage /> },
  { title: "Fee reminders in English and Odia.", copy: "Dues go out in the language the parent reads, with the amount and where to pay.", visual: <FeeReminder /> },
  { title: "Internal marks: draft, submit, lock.", copy: "Faculty draft marks and submit them. An admin locks the sheet, and every change is recorded.", visual: <MarksFlow /> },
  { title: "At-risk flags become mentor tasks.", copy: "A flag only opens a task for the student’s mentor. It never changes the student’s record.", visual: <RiskTask /> },
  { title: "Ask the assistant about your data.", copy: "Plain questions, answered from your records. The assistant reads only and never changes anything.", visual: <AskAssistant /> },
];

export function FeatureShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useSyncExternalStore(subscribeReduced, () => matchMedia(QUERY).matches, () => false);

  useEffect(() => {
    if (paused || reduced) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % SLIDES.length), INTERVAL_MS);
    return () => clearTimeout(t);
  }, [active, paused, reduced]);

  return (
    <div className="space-y-6" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="grid">
        {SLIDES.map((s, i) => (
          <section key={s.title} inert={i !== active} aria-label={`${i + 1} of ${SLIDES.length}`}
            className={cn("col-start-1 row-start-1 space-y-8 transition-opacity duration-300", i === active ? "opacity-100" : "opacity-0")}>
            <div className="max-w-md">
              <h2 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.025em] text-balance">{s.title}</h2>
              <p className="mt-3 text-base text-muted-foreground">{s.copy}</p>
            </div>
            {s.visual}
          </section>
        ))}
      </div>
      <div role="group" aria-label="Choose a feature" className="flex items-center gap-1">
        {SLIDES.map((s, i) => (
          <button key={s.title} type="button" aria-label={`Show ${i + 1}: ${s.title}`} aria-current={i === active} onClick={() => setActive(i)}
            className="flex h-8 min-w-8 items-center justify-center">
            <span className={cn("h-2 rounded-full transition-all duration-300", i === active ? "w-8 bg-foreground" : "w-2 bg-foreground/30")} />
          </button>
        ))}
      </div>
    </div>
  );
}
