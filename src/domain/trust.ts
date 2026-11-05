/** One campus's figures for the trust dashboard. */
export type CampusFigures = {
  campusId: number;
  name: string;
  students: number;
  held: number;
  attended: number;
  shortage: number;
  duesPaise: number;
  flags: number;
};

export type Metric = "attendance" | "shortage" | "duesPaise" | "flags";

/** Attendance is better when higher; shortage, dues and flags are better when lower. */
const HIGHER_IS_BETTER: Record<Metric, boolean> = { attendance: true, shortage: false, duesPaise: false, flags: false };

export const attendancePct = (held: number, attended: number) => (held ? Math.round((attended / held) * 1000) / 10 : null);

function value(row: CampusFigures, metric: Metric): number | null {
  return metric === "attendance" ? attendancePct(row.held, row.attended) : row[metric];
}

/** Totals across campuses and, per metric, the campus ids that do best and worst. Ties and missing values are not ranked. */
export function compare(rows: CampusFigures[]) {
  const totals = {
    students: rows.reduce((n, r) => n + r.students, 0),
    attendance: attendancePct(rows.reduce((n, r) => n + r.held, 0), rows.reduce((n, r) => n + r.attended, 0)),
    shortage: rows.reduce((n, r) => n + r.shortage, 0),
    duesPaise: rows.reduce((n, r) => n + r.duesPaise, 0),
    flags: rows.reduce((n, r) => n + r.flags, 0),
  };
  const metrics = Object.keys(HIGHER_IS_BETTER) as Metric[];
  const best = {} as Record<Metric, number | null>;
  const worst = {} as Record<Metric, number | null>;
  for (const m of metrics) {
    const ranked = rows.flatMap((r) => { const v = value(r, m); return v === null ? [] : [{ id: r.campusId, v }]; });
    const values = new Set(ranked.map((x) => x.v));
    if (ranked.length < 2 || values.size < 2) {
      best[m] = null;
      worst[m] = null;
      continue;
    }
    const sorted = [...ranked].sort((a, b) => (HIGHER_IS_BETTER[m] ? b.v - a.v : a.v - b.v));
    best[m] = sorted[0].id;
    worst[m] = sorted[sorted.length - 1].id;
  }
  return { totals, best, worst };
}
