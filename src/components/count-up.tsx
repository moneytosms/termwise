"use client";

import { useEffect, useRef } from "react";

/** Counts a figure up from zero once on mount; the final value is in the markup, so no script means no change. */
export function CountUp({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 900);
      el.textContent = (value * (1 - Math.pow(1 - k, 4))).toFixed(decimals) + suffix;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, decimals, suffix]);
  return <span ref={ref}>{value.toFixed(decimals)}{suffix}</span>;
}
