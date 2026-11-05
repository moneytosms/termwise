import Link from "next/link";
import { ArrowUpRight, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 md:mb-8">
      <div className="min-w-0">
        <h1 className="text-[1.375rem] leading-tight font-semibold tracking-[-0.015em] text-balance md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Title, item count and an optional action on the right. */
export function SectionHeading({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="mt-10 mb-3 flex items-baseline gap-2 first:mt-0">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {count !== undefined && <span className="text-sm text-muted-foreground tabular-nums">{count}</span>}
      {action && <span className="ml-auto text-sm">{action}</span>}
    </div>
  );
}

/** One white sheet split by 1px seams into equal cells; an odd last cell spans the phone row. */
export function StatStrip({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 | 5 }) {
  return (
    <div className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border shadow-sheet [&>*:last-child:nth-child(odd)]:col-span-2",
      cols === 3 && "md:grid-cols-3 md:[&>*:last-child:nth-child(odd)]:col-span-1",
      cols === 4 && "md:grid-cols-4 md:[&>*:last-child:nth-child(odd)]:col-span-1",
      cols === 5 && "md:grid-cols-3 lg:grid-cols-5 md:[&>*:last-child:nth-child(odd)]:col-span-1")}>
      {children}
    </div>
  );
}

const VALUE_TONE = { default: "", ok: "", late: "", absent: "text-absent" };

/** A label over a figure, one cell of a StatStrip. `href` links the figure to its filtered list. */
export function StatCard({ label, value, hint, tone = "default", href }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: Tone; href?: string;
}) {
  const body = (
    <>
      <span className="flex items-start gap-2 text-[0.8125rem] leading-snug text-muted-foreground">
        <span className="flex-1 text-pretty">{label}</span>
        {href && <ArrowUpRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70" aria-hidden />}
      </span>
      <span className={cn("mt-3 block text-[1.625rem] leading-none font-medium tracking-[-0.02em] tabular-nums md:text-[1.75rem]", VALUE_TONE[tone])}>{value}</span>
      {hint && <span className="mt-2 block text-xs text-muted-foreground">{hint}</span>}
    </>
  );
  const cls = "group flex min-h-28 flex-col bg-card p-4 md:p-5";
  return href
    ? <Link href={href} className={cn(cls, "transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none")}>{body}</Link>
    : <div className={cls}>{body}</div>;
}

/** A link row to another area: title, one line of description and a count that needs action. */
export function ModuleCard({ href, title, description, icon: Icon, count }: {
  href: string; title: string; description: string; icon: LucideIcon; count?: number;
}) {
  return (
    <Link href={href} className="group flex min-h-16 items-center gap-3 rounded-xl bg-card px-4 py-3.5 shadow-sheet transition-colors duration-150 hover:bg-muted/50 active:bg-muted">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-medium">
          {title}
          {count !== undefined && count > 0 && <span className="rounded-full bg-foreground px-1.5 text-xs leading-5 font-medium text-background tabular-nums">{count}</span>}
        </span>
        <span className="mt-0.5 block truncate text-sm text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

const PILL = {
  default: "bg-secondary text-foreground/80",
  ok: "bg-ok-soft text-ok",
  late: "bg-late-soft text-late",
  absent: "bg-absent-soft text-absent",
};
export type Tone = keyof typeof PILL;

/** A record state as a pale pill: always a word, never colour alone. */
export function StatusPill({ tone = "default", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-5 flex-none items-center rounded-full px-2 text-xs font-medium whitespace-nowrap", PILL[tone])}>
      {children}
    </span>
  );
}

/**
 * Attendance against the shortage line: a thin track, the share filled in the data hue
 * (the negative colour once below the line), a tick at the line, the figure on the right.
 */
export function AttendanceMeter({ pct, threshold = 75, className }: { pct: number | null; threshold?: number; className?: string }) {
  if (pct === null) return <span className="text-muted-foreground">–</span>;
  const short = pct < threshold;
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative h-1.5 w-16 flex-none rounded-full bg-secondary" aria-hidden>
        <span className={cn("absolute inset-y-0 left-0 rounded-full", short ? "bg-absent" : "bg-data")} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
        <span className="absolute -inset-y-1 w-px bg-foreground/50" style={{ left: `${threshold}%` }} />
      </span>
      <span className={cn("w-14 text-right tabular-nums", short && "font-medium text-absent")}>{pct.toFixed(1)}%</span>
    </span>
  );
}

/** A white sheet with a header row: title, optional lead figure, optional action on the right. */
export function Panel({ title, figure, action, children, className }: {
  title: string; figure?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-xl bg-card p-4 shadow-sheet md:p-5", className)}>
      <header className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
          {figure && <p className="mt-1 text-[1.625rem] leading-none font-medium tracking-[-0.02em] tabular-nums">{figure}</p>}
        </div>
        {action && <div className="shrink-0 text-sm">{action}</div>}
      </header>
      {children}
    </section>
  );
}

/** "View all" style text link for panel headers. */
export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex items-center gap-0.5 font-medium text-foreground underline-offset-4 hover:underline">{children}<ChevronRight className="size-3.5" aria-hidden /></Link>;
}
