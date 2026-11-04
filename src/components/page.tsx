import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Dot, title, item count and a hairline: separates groups of cards on a page. */
export function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <div className="mb-3 mt-8 flex items-center gap-2 first:mt-0">
      <span className="size-2 rounded-full bg-primary" aria-hidden />
      <h2 className="font-semibold">{title}</h2>
      {count !== undefined && <span className="text-xs text-muted-foreground">{count}</span>}
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}

const TONES = {
  default: "bg-accent text-primary",
  ok: "bg-ok-soft text-ok",
  late: "bg-late-soft text-late",
  absent: "bg-absent-soft text-absent",
};
export type Tone = keyof typeof TONES;

/** Headline figure with a tinted icon tile; give it `href` when the figure links to its filtered list. */
export function StatCard({ label, value, icon: Icon, tone = "default", href }: {
  label: string; value: React.ReactNode; icon: LucideIcon; tone?: Tone; href?: string;
}) {
  const body = (
    <>
      <span>
        <span className="block font-mono text-2xl font-medium">{value}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{label}</span>
      </span>
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", TONES[tone])}><Icon className="size-5" aria-hidden /></span>
    </>
  );
  const cls = "flex items-center justify-between gap-3 rounded-2xl border bg-card p-4";
  return href ? <Link href={href} className={cn(cls, "transition-shadow hover:shadow-md")}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** Icon tile, title, one line of description and a count bubble. */
export function ModuleCard({ href, title, description, icon: Icon, count }: {
  href: string; title: string; description: string; icon: LucideIcon; count?: number;
}) {
  return (
    <Link href={href} className="relative flex gap-4 rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Icon className="size-5" aria-hidden /></span>
      <span className="min-w-0 pr-6">
        <span className="block font-medium">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
      </span>
      {count !== undefined && (
        <span className={cn("absolute right-3 top-3 grid h-6 min-w-6 place-items-center rounded-full px-1.5 font-mono text-xs",
          count > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{count}</span>
      )}
    </Link>
  );
}

/** A state always shows as a word, never colour alone. */
export function StatusPill({ tone = "default", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", TONES[tone])}>{children}</span>;
}
