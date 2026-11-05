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
