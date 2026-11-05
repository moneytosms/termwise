"use client";

import { CloudOff, RotateCw, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** One line plus the next action. */
export function EmptyState({ icon: Icon, title, action }: { icon?: LucideIcon; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-input px-6 py-10 text-center">
      {Icon && <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden />}
      <p className="text-sm text-muted-foreground">{title}</p>
      {action}
    </div>
  );
}

/** Inline message plus retry; whatever the user typed stays where it is. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-card px-4 py-3 text-sm shadow-sheet">
      <TriangleAlert className="size-4 text-absent" aria-hidden />
      <span className="flex-1">{message}</span>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}><RotateCw className="size-3.5" aria-hidden />Retry</Button>}
    </div>
  );
}

export function NeedsConnection({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-input px-6 py-10 text-center">
      <CloudOff className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden />
      <p className="text-sm text-muted-foreground">This page needs a connection. Home, Classes and Mark attendance work offline.</p>
      <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>
    </div>
  );
}

/** Default page skeleton: heading plus a table. Use as loading.tsx. */
export function TableSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 mb-8 h-4 w-72 max-w-full" />
      <Skeleton className="mb-3 h-9 w-full md:w-72" />
      <div className="overflow-hidden rounded-xl bg-card shadow-sheet">
        <div className="flex h-10 items-center gap-6 border-b border-border px-4">{[24, 32, 20, 16].map((w, i) => <Skeleton key={i} className="h-3" style={{ width: `${w * 4}px` }} />)}</div>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex h-11 items-center gap-6 border-b border-rule px-4 last:border-0">
            <Skeleton className="h-3.5 w-28" /><Skeleton className="h-3.5 w-36" /><Skeleton className="h-3.5 w-20" /><Skeleton className="ml-auto h-3.5 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
