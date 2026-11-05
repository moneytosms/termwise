import { isShortage } from "./attendance";
import { categoryLabel, genderLabel } from "./applicants";
import { dues, type Instalment } from "./fees";
import { finalScore, type MarksStatus, type Scheme, type Section } from "./marks";

export type Row = Record<string, string | number | null>;
export type Column = { key: string; label: string };

export const REPORT_KEYS = ["strength", "shortage", "marks", "fees"] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

/** University, AICTE and NAAC returns. Column keys are row keys; labels go in the CSV header. */
export const REPORTS: { key: ReportKey; title: string; columns: Column[] }[] = [
  { key: "strength", title: "Strength", columns: [
    { key: "programme", label: "Programme" }, { key: "year", label: "Year" }, { key: "batch", label: "Batch" },
    { key: "category", label: "Category" }, { key: "gender", label: "Gender" }, { key: "students", label: "Students" },
  ] },
  { key: "shortage", title: "Attendance shortage", columns: [
    { key: "roll", label: "Roll no" }, { key: "name", label: "Name" }, { key: "programme", label: "Programme" }, { key: "subject", label: "Subject" },
    { key: "held", label: "Periods held" }, { key: "attended", label: "Periods attended" }, { key: "percent", label: "Percent" },
  ] },
  { key: "marks", title: "Marks", columns: [
    { key: "code", label: "Subject code" }, { key: "subject", label: "Subject" }, { key: "status", label: "Status" }, { key: "students", label: "Students" },
    { key: "averageInternal", label: "Average internal" }, { key: "averageFinal", label: "Average final" },
    { key: "minFinal", label: "Min final" }, { key: "maxFinal", label: "Max final" },
  ] },
  { key: "fees", title: "Fees", columns: [
    { key: "programme", label: "Programme" }, { key: "students", label: "Students" }, { key: "billed", label: "Billed (INR)" },
    { key: "collected", label: "Collected (INR)" }, { key: "due", label: "Due (INR)" }, { key: "overdue", label: "Overdue (INR)" },
  ] },
];

const percent = (held: number, attended: number) => (held ? Math.round((attended / held) * 1000) / 10 : null);
const average = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);
const rupees = (paise: number) => Math.round(paise) / 100;

/** The month's last day, YYYY-MM-DD. */
export function lastDay(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** The month before today's month, YYYY-MM. */
export function previousMonth(today: string): string {
  const [y, m] = today.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}

/** Fee money is counted as at the end of the month, or today for the current month. */
export function asOfDate(month: string, today: string): string {
  return month === today.slice(0, 7) ? today : lastDay(month);
}

/** One row per student: the batch's strength by programme, year, category and gender. */
export function strengthRows(students: { programme: string; year: number; batch: string; category: string; gender: string | null }[]): Row[] {
  const groups = new Map<string, { programme: string; year: number; batch: string; category: string; gender: string; students: number }>();
  for (const s of students) {
    const category = categoryLabel(s.category);
    const gender = genderLabel(s.gender);
    const key = `${s.programme}|${s.year}|${s.batch}|${category}|${gender}`;
    const g = groups.get(key) ?? { programme: s.programme, year: s.year, batch: s.batch, category, gender, students: 0 };
    g.students++;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => a.programme.localeCompare(b.programme) || a.year - b.year || a.batch.localeCompare(b.batch));
}

export type SubjectAttendance = { roll: string; name: string; programme: string; cutoff: number; subject: string; held: number; attended: number };

/** One row per student and subject with sessions in the month, only where attendance is below the programme's line. */
export function shortageRows(rows: SubjectAttendance[]): Row[] {
  return rows
    .filter((r) => r.held > 0 && isShortage(percent(r.held, r.attended), r.cutoff))
    .sort((a, b) => a.programme.localeCompare(b.programme) || a.roll.localeCompare(b.roll) || a.subject.localeCompare(b.subject))
    .map((r) => ({
      roll: r.roll, name: r.name, programme: r.programme, subject: r.subject,
      held: r.held, attended: r.attended, percent: percent(r.held, r.attended),
    }));
}

export type SubjectMarks = {
  code: string; name: string; status: MarksStatus; scheme: Scheme;
  students: { complete: boolean; marks: Partial<Record<Section, number>> }[];
};

/** Averages, min and max use only students with every mark entered. */
export function marksRows(subjects: SubjectMarks[]): Row[] {
  return subjects
    .map((s) => {
      const done = s.students.filter((x) => x.complete);
      const finals = done.map((x) => finalScore(s.scheme, x.marks).total);
      return {
        code: s.code, subject: s.name, status: s.status, students: s.students.length,
        averageInternal: average(done.map((x) => x.marks.internal ?? 0)),
        averageFinal: average(finals),
        minFinal: finals.length ? Math.min(...finals) : null,
        maxFinal: finals.length ? Math.max(...finals) : null,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

export type StudentFees = { programme: string; instalments: Instalment[] };

/** Money as at a date: only instalments due by then, and only payments made by then. */
export function feeRows(students: StudentFees[], asOf: string): Row[] {
  const groups = new Map<string, { programme: string; students: number; billed: number; collected: number; due: number; overdue: number }>();
  for (const s of students) {
    const g = groups.get(s.programme) ?? { programme: s.programme, students: 0, billed: 0, collected: 0, due: 0, overdue: 0 };
    const due = s.instalments.filter((i) => i.dueDate <= asOf);
    g.students++;
    for (const i of due) {
      g.billed += Math.max(0, i.amountPaise - i.scholarshipPaise);
      g.collected += i.paidPaise;
    }
    const d = dues(due, asOf);
    g.due += d.totalPaise;
    g.overdue += d.overduePaise;
    groups.set(s.programme, g);
  }
  return [...groups.values()]
    .sort((a, b) => a.programme.localeCompare(b.programme))
    .map((g) => ({ programme: g.programme, students: g.students, billed: rupees(g.billed), collected: rupees(g.collected), due: rupees(g.due), overdue: rupees(g.overdue) }));
}

const csvCell = (v: string | number | null) => (v === null ? "" : /[",\r\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v));

/** CSV with a header row of column labels. */
export function toCsv(columns: Column[], rows: Row[]): string {
  const line = (vals: (string | number | null)[]) => vals.map(csvCell).join(",");
  return [line(columns.map((c) => c.label)), ...rows.map((r) => line(columns.map((c) => r[c.key] ?? null)))].join("\n") + "\n";
}
