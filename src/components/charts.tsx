import { cn } from "@/lib/utils";

/**
 * Percent per day as square columns on a 0-100 scale, with a dashed target line.
 * A day with no value draws no bar (honest gap), and its label stays.
 */
export function DayBars({ days, target, label }: {
  days: { label: string; pct: number | null; title: string }[]; target: number; label: string;
}) {
  const ticks = [100, 50, 0];
  return (
    <figure aria-label={label} className="grid grid-cols-[2rem_1fr] gap-x-2">
      <div className="relative h-48 text-[11px] text-muted-foreground tabular-nums" aria-hidden>
        {ticks.map((t) => <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - t}%` }}>{t}%</span>)}
      </div>
      <div className="relative h-48">
        {ticks.map((t) => <span key={t} className={cn("absolute inset-x-0 h-px", t === 0 ? "bg-foreground/40" : "bg-rule")} style={{ top: `${100 - t}%` }} aria-hidden />)}
        <span className="absolute inset-x-0 border-t border-dashed border-foreground/45" style={{ top: `${100 - target}%` }} aria-hidden />
        <ul className="absolute inset-0 grid items-end gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
          {days.map((d, i) => (
            <li key={i} className="flex h-full items-end justify-center" title={d.title}>
              {d.pct !== null && (
                <span className={cn("w-full max-w-12 origin-bottom animate-[grow_600ms_cubic-bezier(0.25,1,0.5,1)_both]", i === days.length - 1 ? "bg-data" : "bg-data/45", d.pct < target && "bg-absent/80")}
                  style={{ height: `${Math.max(d.pct, 1)}%`, animationDelay: `${i * 40}ms` }}>
                  <span className="sr-only">{d.title}</span>
                </span>
              )}
              {d.pct === null && <span className="sr-only">{d.title}</span>}
            </li>
          ))}
        </ul>
      </div>
      <span />
      <div className="mt-2 grid gap-2 text-center text-[11px] text-muted-foreground sm:gap-3" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }} aria-hidden>
        {days.map((d, i) => <span key={i} className={cn(i === days.length - 1 && "font-medium text-foreground")}>{d.label}</span>)}
      </div>
    </figure>
  );
}

/** One session's register as a stacked bar: present in the data hue, late, absent. */
export function RegisterBar({ present, late, absent }: { present: number; late: number; absent: number }) {
  return (
    <span className="flex h-1.5 w-24 overflow-hidden rounded-full bg-secondary" role="img" aria-label={`${present} present, ${late} late, ${absent} absent`}>
      <span className="bg-data/70" style={{ flexGrow: present }} />
      <span className="bg-late" style={{ flexGrow: late }} />
      <span className="bg-absent" style={{ flexGrow: absent }} />
    </span>
  );
}

/** Filled against needed as a short track with the count; complete reads in ink. */
export function Progress({ filled, needed }: { filled: number; needed: number }) {
  const pct = needed ? Math.round((filled / needed) * 100) : 0;
  return (
    <span className="inline-flex shrink-0 items-center gap-2" aria-label={`${filled} of ${needed} entered`}>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary" aria-hidden>
        <span className={cn("block h-full rounded-full", pct === 100 ? "bg-foreground/70" : "bg-data")} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-sm tabular-nums">{filled}<span className="text-muted-foreground">/{needed}</span></span>
    </span>
  );
}

/**
 * Weekly percentages as one line on a fixed scale, with a dashed reference line (the shortage line).
 * Each week is a dot carrying its value on hover; a week with no sessions leaves a gap in the line.
 */
export function TrendLine({ points, reference, label }: {
  points: { label: string; pct: number | null; title: string }[]; reference: number; label: string;
}) {
  const vals = points.flatMap((p) => (p.pct === null ? [] : [p.pct]));
  const lo = Math.min(50, Math.floor(Math.min(reference, ...vals) / 10) * 10);
  const y = (v: number) => 100 - ((v - lo) / (100 - lo)) * 100;
  const x = (i: number) => ((i + 0.5) / points.length) * 100;
  const segments: string[] = [];
  let cur = "";
  points.forEach((p, i) => {
    if (p.pct === null) { if (cur) segments.push(cur); cur = ""; return; }
    cur += `${cur ? "L" : "M"}${x(i)} ${y(p.pct)} `;
  });
  if (cur) segments.push(cur);
  const summary = `${label}: ${points.map((p) => `${p.label} ${p.pct === null ? "no sessions" : `${p.pct}%`}`).join(", ")}`;
  return (
    <div className="grid grid-cols-[2.25rem_1fr] gap-x-2">
      <div className="relative h-44 text-[11px] text-muted-foreground tabular-nums" aria-hidden>
        {[100, reference, lo].map((t) => <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(t)}%` }}>{t}%</span>)}
      </div>
      <div role="img" aria-label={summary} className="relative h-44">
        <span className="absolute inset-x-0 h-px bg-rule" style={{ top: `${y(100)}%` }} aria-hidden />
        <span className="absolute inset-x-0 border-t border-dashed border-foreground/45" style={{ top: `${y(reference)}%` }} aria-hidden />
        <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {segments.map((d, i) => <path key={i} d={d} fill="none" className="stroke-data" strokeWidth={2} vectorEffect="non-scaling-stroke" />)}
        </svg>
        {points.map((p, i) => p.pct !== null && (
          <span key={i} className="group absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center" style={{ left: `${x(i)}%`, top: `${y(p.pct)}%` }}>
            <span className={cn("size-2 rounded-full", p.pct < reference ? "bg-absent" : "bg-data")} aria-hidden />
            <span className="pointer-events-none absolute bottom-full mb-1 hidden rounded bg-foreground px-1.5 py-0.5 text-[11px] whitespace-nowrap text-background tabular-nums group-hover:block" aria-hidden>{p.title}</span>
          </span>
        ))}
      </div>
      <span />
      <div className="mt-2 grid text-center text-[11px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${points.length}, 1fr)` }} aria-hidden>
        {points.map((p, i) => <span key={i} className={cn(i === points.length - 1 && "font-medium text-foreground")}>{p.label}</span>)}
      </div>
    </div>
  );
}

/**
 * Ranked rows as text with a bar under each. The text carries the value for screen readers and the
 * row's title gives the full figure on hover. A bar is red when `alert` is set.
 */
export function HBars({ rows, max }: {
  rows: { key: string | number; label: string; sub?: string; value: number; valueLabel: string; alert?: boolean; title: string }[]; max: number;
}) {
  return (
    <ul className="grid gap-2.5">
      {rows.map((r) => (
        <li key={r.key} title={r.title} className="-mx-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 rounded-md px-2 py-1 text-sm hover:bg-muted/60">
          <span className="min-w-0"><span className="block truncate">{r.label}</span>{r.sub && <span className="block text-xs text-muted-foreground">{r.sub}</span>}</span>
          <span className={cn("self-start tabular-nums", r.alert && "font-medium text-absent")}>{r.valueLabel}</span>
          <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
            <span className={cn("block h-full rounded-full", r.alert ? "bg-absent" : "bg-data")} style={{ width: `${max ? Math.min(100, (r.value / max) * 100) : 0}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Parts of one whole as a segmented bar; the legend repeats every value, so colour is never the only key. */
export function StackedBar({ parts, label }: {
  parts: { name: string; value: number; text?: string; className: string }[]; label: string;
}) {
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div>
      <div role="img" aria-label={`${label}: ${parts.map((p) => `${p.name} ${p.text ?? p.value}`).join(", ")}`} className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {shown.map((p) => <span key={p.name} className={p.className} style={{ flexGrow: p.value }} />)}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-hidden>
        {parts.map((p) => (
          <li key={p.name} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-sm", p.className)} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="font-medium tabular-nums">{p.text ?? p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
