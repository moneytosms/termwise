"use client";

import { CloudOff, RotateCw, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** One line plus the next action. */
export function EmptyState({ icon: Icon, title, action }: { icon?: LucideIcon; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      {Icon && <Icon className="size-6 text-muted-foreground" aria-hidden />}
      <p className="text-sm text-muted-foreground">{title}</p>
      {action}
    </div>
  );
}

/** Inline message plus retry; whatever the user typed stays where it is. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-absent/30 bg-absent-soft px-4 py-3 text-sm">
      <TriangleAlert className="size-4 text-absent" aria-hidden />
      <span className="flex-1">{message}</span>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}><RotateCw className="size-3.5" aria-hidden />Retry</Button>}
    </div>
  );
}

export function NeedsConnection({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <CloudOff className="size-6 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">Needs a connection</p>
      <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>
    </div>
  );
}

/** Default page skeleton: heading plus a table. Use as loading.tsx. */
export function TableSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="space-y-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
    </div>
  );
}
