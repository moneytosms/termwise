import { cn } from "@/lib/utils";

/** Termwise mark: a register of nine cells with one period ticked in the data hue. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-7", className)} aria-hidden>
      <rect width="24" height="24" rx="6" className="fill-foreground" />
      {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => (
        <rect key={`${r}${c}`} x={5 + c * 5} y={5 + r * 5} width="4" height="4" rx="1"
          className={r === 1 && c === 2 ? "fill-[#5b9bf0]" : "fill-background"} opacity={r === 1 && c === 2 ? 1 : 0.85 - r * 0.2} />
      )))}
    </svg>
  );
}
