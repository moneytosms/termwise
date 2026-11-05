import { categoryLabel } from "./applicants";
import { instalmentDue, type Instalment } from "./fees";

export type SchemeTerms = { kind: "fixed" | "percent"; value: number };
export type SchemeLimit = { active: boolean; categories: string[] };
export type SpreadInstalment = Instalment & { semester: number | null };

/** The award in paise: a percent of the semester total, or a fixed amount capped at that total. */
export function awardAmount(scheme: SchemeTerms, semesterTotalPaise: number): number {
  return scheme.kind === "percent"
    ? Math.round((semesterTotalPaise * scheme.value) / 100)
    : Math.min(scheme.value, semesterTotalPaise);
}

/** Why a student's category can't take this scheme, or null when it can. */
export function eligibilityError(scheme: SchemeLimit, category: string): string | null {
  if (!scheme.active) return "This scheme is no longer active.";
  if (scheme.categories.length === 0 || scheme.categories.includes(category)) return null;
  return `This scheme is limited to ${scheme.categories.map(categoryLabel).join(", ")}.`;
}

/** The instalments that belong to a semester: explicit semester, or null meaning the batch's current one. */
export function semesterInstalments<T extends SpreadInstalment>(instalments: T[], semester: number, batchSemester: number): T[] {
  return instalments.filter((i) => (i.semester ?? batchSemester) === semester);
}

const byDueDate = <T extends { dueDate: string }>(list: T[]) => [...list].sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));

/** Per-instalment scholarship increments for an award, earliest due first, each capped at what's left on it. */
export function spread(instalments: Instalment[], amount: number): { id: number; addPaise: number }[] {
  let left = amount;
  const out: { id: number; addPaise: number }[] = [];
  for (const i of byDueDate(instalments)) {
    if (left <= 0) break;
    const room = Math.max(0, i.amountPaise - i.scholarshipPaise);
    const add = Math.min(room, left);
    if (add > 0) out.push({ id: i.id, addPaise: add });
    left -= add;
  }
  return out;
}

/** Per-instalment scholarship decrements that undo an award, latest due first, never below zero. */
export function unspread(instalments: Instalment[], amount: number): { id: number; subPaise: number }[] {
  let left = amount;
  const out: { id: number; subPaise: number }[] = [];
  for (const i of byDueDate(instalments).reverse()) {
    if (left <= 0) break;
    const sub = Math.min(i.scholarshipPaise, left);
    if (sub > 0) out.push({ id: i.id, subPaise: sub });
    left -= sub;
  }
  return out;
}

/** Total still due across a set of instalments. */
export const totalDue = (instalments: Instalment[]) => instalments.reduce((sum, i) => sum + instalmentDue(i), 0);
