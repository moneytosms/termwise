import { classesToReach } from "@/domain/attendance";

/** Largest k with attended / (held + k) at or above cutoff%. Same integer rule as classesToReach. */
export function canMiss(attended: number, held: number, cutoff: number): number {
  return Math.max(0, Math.floor((attended * 100) / cutoff) - held);
}

/** Plain-language planner line for one subject. */
export function plannerLine(attended: number, held: number, cutoff: number): string {
  const need = classesToReach(attended, held, cutoff);
  if (need > 0) return `Attend the next ${need} in a row to reach ${cutoff}%`;
  const k = canMiss(attended, held, cutoff);
  return k > 0 ? `You can miss ${k} and stay at or above ${cutoff}%` : `Any miss now drops you below ${cutoff}%`;
}
