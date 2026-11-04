"use client";

import { ErrorState, NeedsConnection } from "@/components/states";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return <NeedsConnection onRetry={reset} />;
  return <ErrorState message={error.message.includes("only") || error.message.startsWith("Not ") ? "You don't have access to this." : "Something went wrong loading this page."} onRetry={reset} />;
}
