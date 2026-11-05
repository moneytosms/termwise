import { isShortage } from "./attendance";
import { categoryLabel, genderLabel } from "./applicants";
import { dues, type Instalment } from "./fees";
import type { Capability } from "./roles";
import { finalScore, type MarksStatus, type Scheme, type Section } from "./marks";

export type Row = Record<string, string | number | null>;
export type Column = { key: string; label: string };

export const REPORT_KEYS = ["strength", "shortage", "marks", "fees", "aicte_intake", "aicte_faculty", "aicte_sfr", "aicte_cadre", "naac_2_1_1", "naac_2_2", "naac_2_4_1", "naac_2_6_3", "naac_5_1_1"] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

/** The capability that opens each report: the fees return is for accounts, the rest for exams. */
export const REPORT_CAP: Record<ReportKey, Capability> = {
  strength: "reports", shortage: "reports", marks: "reports", fees: "fee_reports",
  aicte_intake: "reports", aicte_faculty: "reports", aicte_sfr: "reports", aicte_cadre: "reports",
  naac_2_1_1: "reports", naac_2_2: "reports", naac_2_4_1: "reports", naac_2_6_3: "reports", naac_5_1_1: "reports",
};

/** University, AICTE and NAAC returns. Column keys are row keys; labels go in the CSV header. */
export const REPORTS: { key: ReportKey; title: string; columns: Column[]; note?: string }[] = [
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
  { key: "aicte_intake", title: "AICTE intake", note: "[A] Sanctioned seats against everyone admitted in each admission year, alumni included. Pharmacy reports to PCI; same layout used.", columns: [
    { key: "programme", label: "Programme" }, { key: "year", label: "Admission year" }, { key: "sanctioned", label: "Sanctioned" }, { key: "admitted", label: "Admitted" },
    { key: "general", label: "General" }, { key: "obc", label: "OBC" }, { key: "sc", label: "SC" }, { key: "st", label: "ST" }, { key: "ews", label: "EWS" },
    { key: "male", label: "Male" }, { key: "female", label: "Female" }, { key: "other", label: "Other" }, { key: "genderNotRecorded", label: "Gender not recorded" },
  ] },
  { key: "aicte_faculty", title: "AICTE faculty", note: "[A] Faculty and HODs by department, with designation and qualification as recorded in College setup.", columns: [
    { key: "department", label: "Department" }, { key: "name", label: "Name" }, { key: "designation", label: "Designation" }, { key: "qualification", label: "Qualification" },
  ] },
  { key: "aicte_sfr", title: "AICTE student-faculty ratio", note: "[A] Students not yet alumni per faculty member of the programme's department, against a 1:20 norm. Below norm when over 20 students per faculty or no faculty.", columns: [
    { key: "programme", label: "Programme" }, { key: "students", label: "Students" }, { key: "faculty", label: "Faculty" },
    { key: "ratio", label: "Ratio" }, { key: "norm", label: "Norm" }, { key: "status", label: "Status" },
  ] },
  { key: "aicte_cadre", title: "AICTE cadre ratio", note: "[A] Professors, associate and assistant professors per department, against 1:2:6. Below norm when professors or associates fall short of 1 and 2 per 6 assistants.", columns: [
    { key: "department", label: "Department" }, { key: "professors", label: "Professors" }, { key: "associates", label: "Associate professors" },
    { key: "assistants", label: "Assistant professors" }, { key: "ratio", label: "Ratio" }, { key: "norm", label: "Norm" }, { key: "status", label: "Status" },
  ] },
  { key: "naac_2_1_1", title: "NAAC 2.1.1 Enrolment percentage", note: "[A] Enrolment % = students admitted in the admission year (alumni included) / sanctioned seats of the programmes with a batch that year, x 100.", columns: [
    { key: "year", label: "Admission year" }, { key: "admitted", label: "Admitted" }, { key: "sanctioned", label: "Sanctioned seats" }, { key: "percent", label: "Enrolment %" },
  ] },
  { key: "naac_2_2", title: "NAAC 2.2 Student : full-time teacher ratio", note: "[A] Students not yet alumni / full-time teachers (faculty and HODs) on the campus. Campus-wide; the programme filter does not apply.", columns: [
    { key: "students", label: "Students" }, { key: "teachers", label: "Full-time teachers" }, { key: "ratio", label: "Ratio" },
  ] },
  { key: "naac_2_4_1", title: "NAAC 2.4.1 Full-time teachers against sanctioned posts", note: "[A] Full-time teachers (faculty and HODs) / sanctioned posts of the department, x 100. Posts are set in College setup, Departments. Campus-wide; the programme filter does not apply.", columns: [
    { key: "department", label: "Department" }, { key: "teachers", label: "Full-time teachers" }, { key: "posts", label: "Sanctioned posts" }, { key: "percent", label: "%" },
  ] },
  { key: "naac_2_6_3", title: "NAAC 2.6.3 Pass percentage of final-year students", note: "[A] Final year = batch year equal to the programme's duration; alumni included. A student passes when every locked-subject result is at least the pass mark; students with no locked result yet are not counted. Pass mark 40 of 100 [A]; a lab subject's pass mark is 40% of its full total.", columns: [
    { key: "programme", label: "Programme" }, { key: "students", label: "Final-year students" }, { key: "passed", label: "Passed" }, { key: "percent", label: "Pass %" },
  ] },
  { key: "naac_5_1_1", title: "NAAC 5.1.1 Students benefited by scholarships", note: "[A] Students not yet alumni with an award not withdrawn from each funding source / students not yet alumni on the campus, x 100. A student with awards from two sources counts under both. The programme filter applies to both counts.", columns: [
    { key: "source", label: "Funding source" }, { key: "benefited", label: "Students benefited" }, { key: "total", label: "Total students" }, { key: "percent", label: "%" },
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

const DESIGNATION_LABEL: Record<string, string> = { professor: "Professor", associate_professor: "Associate Professor", assistant_professor: "Assistant Professor" };

export type IntakeBatch = { programme: string; sanctioned: number; year: number };
export type IntakeStudent = { programme: string; year: number; category: string; gender: string | null };

/** Sanctioned seats and admissions per programme and admission year, by category and gender. Alumni count as admitted. */
export function intakeRows(batches: IntakeBatch[], students: IntakeStudent[]): Row[] {
  type Group = { programme: string; year: number; sanctioned: number; admitted: number; counts: Record<string, number> };
  const groups = new Map<string, Group>();
  const blank = (): Record<string, number> => ({ general: 0, obc: 0, sc: 0, st: 0, ews: 0, male: 0, female: 0, other: 0, genderNotRecorded: 0 });
  for (const b of batches) {
    const key = `${b.programme}|${b.year}`;
    if (!groups.has(key)) groups.set(key, { programme: b.programme, year: b.year, sanctioned: b.sanctioned, admitted: 0, counts: blank() });
  }
  for (const s of students) {
    const g = groups.get(`${s.programme}|${s.year}`);
    if (!g) continue;
    g.admitted++;
    g.counts[s.category] = (g.counts[s.category] ?? 0) + 1;
    const gk = s.gender ?? "genderNotRecorded";
    g.counts[gk] = (g.counts[gk] ?? 0) + 1;
  }
  return [...groups.values()]
    .sort((a, b) => a.programme.localeCompare(b.programme) || a.year - b.year)
    .map((g) => ({ programme: g.programme, year: g.year, sanctioned: g.sanctioned, admitted: g.admitted, ...g.counts }));
}

export type FacultyStaff = { department: string | null; name: string; role: string; designation: string | null; qualification: string | null };

/** Faculty and HODs by department, name. Missing designation or qualification reads "Not recorded". */
export function aicteFacultyRows(staff: FacultyStaff[]): Row[] {
  return staff
    .filter((s) => s.role === "faculty" || s.role === "hod")
    .sort((a, b) => (a.department ?? "").localeCompare(b.department ?? "") || a.name.localeCompare(b.name))
    .map((s) => ({
      department: s.department, name: s.name,
      designation: s.designation ? DESIGNATION_LABEL[s.designation] ?? s.designation : "Not recorded",
      qualification: s.qualification ?? "Not recorded",
    }));
}

export type SfrProgramme = { code: string; departmentId: number | null };
export type TeachingStaff = { departmentId: number | null; role: string; designation: string | null };

/** Students not alumni per faculty member of the programme's department. */
export function sfrRows(programmes: SfrProgramme[], students: { programme: string }[], staff: TeachingStaff[]): Row[] {
  const studentCount = new Map<string, number>();
  for (const s of students) studentCount.set(s.programme, (studentCount.get(s.programme) ?? 0) + 1);
  return [...programmes]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((p) => {
      const count = studentCount.get(p.code) ?? 0;
      const faculty = p.departmentId === null ? 0 : staff.filter((s) => s.role === "faculty" && s.departmentId === p.departmentId).length;
      const low = faculty === 0 || count / faculty > 20;
      return {
        programme: p.code, students: count, faculty,
        ratio: faculty ? `1:${(count / faculty).toFixed(1)}` : "—",
        norm: "1:20", status: low ? "Below norm" : "OK",
      };
    });
}

/** Professors, associate and assistant professors per department. Below norm when short of 1 and 2 per 6 assistants. */
export function cadreRows(departments: { id: number; name: string }[], staff: TeachingStaff[]): Row[] {
  return [...departments]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => {
      const mine = staff.filter((s) => s.role === "faculty" && s.departmentId === d.id);
      const count = (designation: string) => mine.filter((s) => s.designation === designation).length;
      const professors = count("professor");
      const associates = count("associate_professor");
      const assistants = count("assistant_professor");
      const unit = Math.floor(assistants / 6);
      const low = professors < unit || associates < unit * 2;
      return {
        department: d.name, professors, associates, assistants,
        ratio: `${professors}:${associates}:${assistants}`, norm: "1:2:6", status: low ? "Below norm" : "OK",
      };
    });
}

/** Pass mark as a percentage of a subject's full total, which is 100 for theory. */
export const PASS_MARK = 40;

/** A subject's full total: theory scale, plus the lab sections for a lab. */
export function maxTotal(s: Pick<Scheme, "kind" | "theoryScale" | "labExamMax" | "vivaMax" | "ceMax">): number {
  return s.theoryScale + (s.kind === "lab" ? s.labExamMax + s.vivaMax + s.ceMax : 0);
}

/** The mark a result needs to pass its subject. */
export const passMarkFor = (s: Pick<Scheme, "kind" | "theoryScale" | "labExamMax" | "vivaMax" | "ceMax">) => (PASS_MARK * maxTotal(s)) / 100;

/** numerator / denominator as a percent to one decimal; null when there is nothing to divide by. */
const share = (num: number, den: number) => (den ? Math.round((num / den) * 1000) / 10 : null);

/** Admitted against sanctioned seats per admission year. A programme's seats count once a year, however many batches it has. */
export function enrolmentRows(batches: { programme: string; sanctioned: number; year: number }[], students: { year: number }[]): Row[] {
  const years = new Map<number, { sanctioned: number; admitted: number; programmes: Set<string> }>();
  for (const b of batches) {
    const y = years.get(b.year) ?? { sanctioned: 0, admitted: 0, programmes: new Set<string>() };
    if (!y.programmes.has(b.programme)) {
      y.programmes.add(b.programme);
      y.sanctioned += b.sanctioned;
    }
    years.set(b.year, y);
  }
  for (const s of students) {
    const y = years.get(s.year);
    if (y) y.admitted++;
  }
  return [...years.entries()].sort(([a], [b]) => a - b).map(([year, y]) => ({
    year, admitted: y.admitted, sanctioned: y.sanctioned, percent: share(y.admitted, y.sanctioned),
  }));
}

/** One campus row: students not yet alumni against full-time teachers (faculty and HODs). */
export function studentTeacherRows(students: number, staff: TeachingStaff[]): Row[] {
  const teachers = staff.filter((s) => s.role === "faculty" || s.role === "hod").length;
  return [{ students, teachers, ratio: teachers ? `${(students / teachers).toFixed(1)}:1` : null }];
}

/** Full-time teachers against the department's sanctioned posts. Percent is blank when there are no posts. */
export function departmentPostRows(departments: { id: number; name: string; sanctionedPosts: number }[], staff: TeachingStaff[]): Row[] {
  return [...departments]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => {
      const teachers = staff.filter((s) => (s.role === "faculty" || s.role === "hod") && s.departmentId === d.id).length;
      return { department: d.name, teachers, posts: d.sanctionedPosts, percent: share(teachers, d.sanctionedPosts) };
    });
}

export type ResultLine = { studentId: number; programme: string; total: number; passMark: number };

/** A student passes when every result line of theirs reaches its pass mark. Programmes with no final-year students show a blank percent. */
export function passRows(programmes: string[], results: ResultLine[]): Row[] {
  const byStudent = new Map<number, { programme: string; passed: boolean }>();
  for (const r of results) {
    const s = byStudent.get(r.studentId) ?? { programme: r.programme, passed: true };
    if (r.total < r.passMark) s.passed = false;
    byStudent.set(r.studentId, s);
  }
  const students = [...byStudent.values()];
  return [...new Set(programmes)].sort((a, b) => a.localeCompare(b)).map((code) => {
    const mine = students.filter((s) => s.programme === code);
    const passed = mine.filter((s) => s.passed).length;
    return { programme: code, students: mine.length, passed, percent: share(passed, mine.length) };
  });
}

const FUNDING: { source: "government" | "institution" | "non_government"; label: string }[] = [
  { source: "government", label: "Government" }, { source: "institution", label: "Institution" }, { source: "non_government", label: "Non-government" },
];

/** Distinct students with an award per funding source, against the campus's students not yet alumni. */
export function scholarshipRows(awards: { studentId: number; fundingSource: string }[], totalStudents: number): Row[] {
  return FUNDING.map(({ source, label }) => {
    const benefited = new Set(awards.filter((a) => a.fundingSource === source).map((a) => a.studentId)).size;
    return { source: label, benefited, total: totalStudents, percent: share(benefited, totalStudents) };
  });
}

const csvCell = (v: string | number | null) => (v === null ? "" : /[",\r\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v));

/** CSV with a header row of column labels. */
export function toCsv(columns: Column[], rows: Row[]): string {
  const line = (vals: (string | number | null)[]) => vals.map(csvCell).join(",");
  return [line(columns.map((c) => c.label)), ...rows.map((r) => line(columns.map((c) => r[c.key] ?? null)))].join("\n") + "\n";
}
