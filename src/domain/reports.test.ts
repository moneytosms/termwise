import { describe, expect, it } from "vitest";
import { aicteFacultyRows, asOfDate, cadreRows, departmentPostRows, enrolmentRows, feeRows, intakeRows, lastDay, marksRows, maxTotal, passMarkFor, passRows, PASS_MARK, previousMonth, scholarshipRows, sfrRows, shortageRows, strengthRows, studentTeacherRows, toCsv, REPORTS } from "./reports";
import type { Scheme } from "./marks";

const scheme: Scheme = { kind: "theory", internalMax: 40, midMax: 20, endMax: 40, theoryScale: 100, labExamMax: 15, vivaMax: 10, ceMax: 5 };

describe("strengthRows", () => {
  it("counts students per programme, year, batch, category and gender", () => {
    expect(strengthRows([
      { programme: "CSE", year: 2, batch: "CSE-24", category: "obc", gender: "female" },
      { programme: "CSE", year: 2, batch: "CSE-24", category: "obc", gender: "female" },
      { programme: "CSE", year: 2, batch: "CSE-24", category: "general", gender: "male" },
      { programme: "ME", year: 1, batch: "ME-25", category: "general", gender: null },
    ])).toEqual([
      { programme: "CSE", year: 2, batch: "CSE-24", category: "OBC", gender: "Female", students: 2 },
      { programme: "CSE", year: 2, batch: "CSE-24", category: "General", gender: "Male", students: 1 },
      { programme: "ME", year: 1, batch: "ME-25", category: "General", gender: "Not recorded", students: 1 },
    ]);
  });
});

describe("shortageRows", () => {
  it("keeps only subject rows below the programme cutoff and computes the percent", () => {
    const out = shortageRows([
      { roll: "A1", name: "Asha", programme: "CSE", cutoff: 75, subject: "Maths", held: 20, attended: 14 },
      { roll: "A1", name: "Asha", programme: "CSE", cutoff: 75, subject: "Physics", held: 20, attended: 16 },
      { roll: "A2", name: "Ravi", programme: "CSE", cutoff: 75, subject: "Maths", held: 0, attended: 0 },
    ]);
    expect(out).toEqual([
      { roll: "A1", name: "Asha", programme: "CSE", subject: "Maths", held: 20, attended: 14, percent: 70 },
    ]);
  });
});

describe("marksRows", () => {
  const complete = { complete: true, marks: { internal: 30, mid: 15, end: 30 } };
  it("averages and ranges final scores over students with all marks only", () => {
    const [row] = marksRows([{
      code: "CS101", name: "Maths", status: "locked", scheme,
      students: [complete, { complete: true, marks: { internal: 20, mid: 10, end: 20 } }, { complete: false, marks: { internal: 40 } }],
    }]);
    expect(row).toEqual({
      code: "CS101", subject: "Maths", status: "locked", students: 3,
      averageInternal: 25, averageFinal: 62.5, minFinal: 50, maxFinal: 75,
    });
  });
  it("leaves averages blank when no student is complete", () => {
    const [row] = marksRows([{ code: "CS102", name: "Physics", status: "draft", scheme, students: [{ complete: false, marks: {} }] }]);
    expect(row).toMatchObject({ students: 1, averageInternal: null, averageFinal: null, minFinal: null, maxFinal: null });
  });
});

describe("feeRows", () => {
  it("counts only instalments due by the as-of date and payments made to date", () => {
    const i = (o: Partial<{ dueDate: string; amountPaise: number; scholarshipPaise: number; paidPaise: number }>) => ({
      id: 1, dueDate: "2026-10-01", amountPaise: 100_00, scholarshipPaise: 0, paidPaise: 0, ...o,
    });
    expect(feeRows([
      { programme: "CSE", instalments: [i({ paidPaise: 40_00 }), i({ dueDate: "2026-11-15" })] },
      { programme: "CSE", instalments: [] },
    ], "2026-10-31")).toEqual([
      { programme: "CSE", students: 2, billed: 100, collected: 40, due: 60, overdue: 60 },
    ]);
  });
  it("counts instalments past due as overdue", () => {
    const [row] = feeRows([{ programme: "ME", instalments: [{ id: 1, dueDate: "2026-09-01", amountPaise: 50_00, scholarshipPaise: 10_00, paidPaise: 0 }] }], "2026-10-31");
    expect(row).toMatchObject({ billed: 40, due: 40, overdue: 40 });
  });
});

describe("as-of and month helpers", () => {
  it("uses the last day of a past month and today for the current month", () => {
    expect(lastDay("2026-02")).toBe("2026-02-28");
    expect(asOfDate("2026-10", "2026-11-06")).toBe("2026-10-31");
    expect(asOfDate("2026-11", "2026-11-06")).toBe("2026-11-06");
  });
  it("finds the previous month across a year boundary", () => {
    expect(previousMonth("2026-01-03")).toBe("2025-12");
    expect(previousMonth("2026-11-06")).toBe("2026-10");
  });
});

describe("toCsv", () => {
  const columns = [{ key: "name", label: "Name" }, { key: "note", label: "Note" }, { key: "n", label: "N" }];
  it("writes a header row and escapes commas, quotes and newlines", () => {
    expect(toCsv(columns, [
      { name: "Asha, K", note: 'says "hi"', n: 3 },
      { name: "Ravi", note: "line1\nline2", n: null },
    ])).toBe('Name,Note,N\n"Asha, K","says ""hi""",3\nRavi,"line1\nline2",\n');
  });
  it("is header only when there are no rows", () => {
    expect(toCsv(columns, [])).toBe("Name,Note,N\n");
  });
  it("gives every report a column for each row key", () => {
    for (const r of REPORTS) expect(new Set(r.columns.map((c) => c.key)).size).toBe(r.columns.length);
  });
});

describe("intakeRows", () => {
  it("counts admissions per programme and year by category and gender, alumni included", () => {
    expect(intakeRows(
      [
        { programme: "CSE", sanctioned: 120, year: 2024 },
        { programme: "CSE", sanctioned: 120, year: 2025 },
        { programme: "ME", sanctioned: 60, year: 2024 },
      ],
      [
        { programme: "CSE", year: 2024, category: "general", gender: "male" },
        { programme: "CSE", year: 2024, category: "obc", gender: "female" },
        { programme: "CSE", year: 2024, category: "general", gender: null },
        { programme: "ME", year: 2024, category: "sc", gender: "other" },
        { programme: "ME", year: 2023, category: "general", gender: "male" },
      ],
    )).toEqual([
      { programme: "CSE", year: 2024, sanctioned: 120, admitted: 3, general: 2, obc: 1, sc: 0, st: 0, ews: 0, male: 1, female: 1, other: 0, genderNotRecorded: 1 },
      { programme: "CSE", year: 2025, sanctioned: 120, admitted: 0, general: 0, obc: 0, sc: 0, st: 0, ews: 0, male: 0, female: 0, other: 0, genderNotRecorded: 0 },
      { programme: "ME", year: 2024, sanctioned: 60, admitted: 1, general: 0, obc: 0, sc: 1, st: 0, ews: 0, male: 0, female: 0, other: 1, genderNotRecorded: 0 },
    ]);
  });
});

describe("aicteFacultyRows", () => {
  it("lists faculty and HODs by department and name, with blanks as Not recorded", () => {
    expect(aicteFacultyRows([
      { department: "CSE", name: "Ravi", role: "faculty", designation: "professor", qualification: "Ph.D." },
      { department: "CSE", name: "Asha", role: "faculty", designation: null, qualification: null },
      { department: "ME", name: "Kiran", role: "hod", designation: "associate_professor", qualification: "M.E." },
      { department: "CSE", name: "Office", role: "office_admin", designation: null, qualification: null },
    ])).toEqual([
      { department: "CSE", name: "Asha", designation: "Not recorded", qualification: "Not recorded" },
      { department: "CSE", name: "Ravi", designation: "Professor", qualification: "Ph.D." },
      { department: "ME", name: "Kiran", designation: "Associate Professor", qualification: "M.E." },
    ]);
  });
});

describe("sfrRows", () => {
  const students = (programme: string, n: number) => Array.from({ length: n }, () => ({ programme }));
  it("divides students by the faculty of the programme's department and flags ratios above 20", () => {
    const rows = sfrRows(
      [
        { code: "CSE", departmentId: 1 },
        { code: "ME", departmentId: 2 },
        { code: "MBA", departmentId: null },
        { code: "BPH", departmentId: 3 },
      ],
      [...students("CSE", 41), ...students("ME", 3), ...students("MBA", 1), ...students("BPH", 40)],
      [
        { departmentId: 1, role: "faculty", designation: null },
        { departmentId: 1, role: "faculty", designation: null },
        { departmentId: 1, role: "office_admin", designation: null },
        { departmentId: 2, role: "faculty", designation: null },
        { departmentId: 2, role: "hod", designation: null },
        { departmentId: 3, role: "faculty", designation: null },
        { departmentId: 3, role: "faculty", designation: null },
      ],
    );
    expect(rows).toEqual([
      { programme: "BPH", students: 40, faculty: 2, ratio: "1:20.0", norm: "1:20", status: "OK" },
      { programme: "CSE", students: 41, faculty: 2, ratio: "1:20.5", norm: "1:20", status: "Below norm" },
      { programme: "MBA", students: 1, faculty: 0, ratio: "—", norm: "1:20", status: "Below norm" },
      { programme: "ME", students: 3, faculty: 2, ratio: "1:1.5", norm: "1:20", status: "OK" },
    ]);
  });
});

describe("cadreRows", () => {
  const s = (departmentId: number, designation: string | null) => ({ departmentId, role: "faculty", designation });
  it("counts designations per department and flags departments short of the 1:2:6 norm", () => {
    const rows = cadreRows(
      [{ id: 1, name: "CSE" }, { id: 2, name: "ME" }, { id: 3, name: "EEE" }],
      [
        s(1, "professor"), s(1, "associate_professor"), s(1, "associate_professor"), s(1, null),
        ...Array.from({ length: 7 }, () => s(1, "assistant_professor")),
        s(3, "professor"), s(3, "associate_professor"), ...Array.from({ length: 6 }, () => s(3, "assistant_professor")),
        ...Array.from({ length: 6 }, () => s(2, "assistant_professor")),
        { departmentId: 2, role: "hod", designation: "professor" },
      ],
    );
    expect(rows).toEqual([
      { department: "CSE", professors: 1, associates: 2, assistants: 7, ratio: "1:2:7", norm: "1:2:6", status: "OK" },
      { department: "EEE", professors: 1, associates: 1, assistants: 6, ratio: "1:1:6", norm: "1:2:6", status: "Below norm" },
      { department: "ME", professors: 1, associates: 0, assistants: 6, ratio: "1:0:6", norm: "1:2:6", status: "Below norm" },
    ]);
  });
});

describe("passMarkFor", () => {
  it("is 40 of 100 for a theory subject", () => {
    expect(passMarkFor(scheme)).toBe(PASS_MARK);
    expect(PASS_MARK).toBe(40);
  });
  it("is 40% of the full total for a lab, which adds labExam, viva and CE on top of theory", () => {
    expect(maxTotal({ ...scheme, kind: "lab" })).toBe(130);
    expect(passMarkFor({ ...scheme, kind: "lab" })).toBe(52);
  });
});

describe("enrolmentRows", () => {
  it("sums sanctioned seats once per programme per admission year and counts all admitted students", () => {
    expect(enrolmentRows(
      [
        { programme: "CSE", sanctioned: 60, year: 2025 },
        { programme: "CSE", sanctioned: 60, year: 2025 },
        { programme: "ME", sanctioned: 60, year: 2025 },
        { programme: "CSE", sanctioned: 60, year: 2024 },
      ],
      [{ year: 2025 }, { year: 2025 }, { year: 2025 }, { year: 2024 }, { year: 2023 }],
    )).toEqual([
      { year: 2024, admitted: 1, sanctioned: 60, percent: 1.7 },
      { year: 2025, admitted: 3, sanctioned: 120, percent: 2.5 },
    ]);
  });
  it("leaves the percent blank when no seats are sanctioned", () => {
    expect(enrolmentRows([], [{ year: 2025 }])).toEqual([]);
    expect(enrolmentRows([{ programme: "CSE", sanctioned: 0, year: 2025 }], [{ year: 2025 }])).toEqual([
      { year: 2025, admitted: 1, sanctioned: 0, percent: null },
    ]);
  });
});

describe("studentTeacherRows", () => {
  it("counts faculty and HODs as teachers and leaves the ratio blank with none", () => {
    expect(studentTeacherRows(90, [
      { departmentId: 1, role: "faculty", designation: null },
      { departmentId: 1, role: "faculty", designation: null },
      { departmentId: 2, role: "hod", designation: null },
      { departmentId: 2, role: "hr", designation: null },
    ])).toEqual([{ students: 90, teachers: 3, ratio: "30.0:1" }]);
    expect(studentTeacherRows(5, [])).toEqual([{ students: 5, teachers: 0, ratio: null }]);
  });
});

describe("departmentPostRows", () => {
  it("compares teachers with sanctioned posts per department, sorted by name", () => {
    expect(departmentPostRows(
      [{ id: 2, name: "ME", sanctionedPosts: 20 }, { id: 1, name: "CSE", sanctionedPosts: 30 }, { id: 3, name: "MBA", sanctionedPosts: 0 }],
      [
        { departmentId: 1, role: "faculty", designation: null },
        { departmentId: 1, role: "hod", designation: null },
        { departmentId: 2, role: "faculty", designation: null },
        { departmentId: 3, role: "faculty", designation: null },
      ],
    )).toEqual([
      { department: "CSE", teachers: 2, posts: 30, percent: 6.7 },
      { department: "MBA", teachers: 1, posts: 0, percent: null },
      { department: "ME", teachers: 1, posts: 20, percent: 5 },
    ]);
  });
});

describe("passRows", () => {
  const line = (studentId: number, programme: string, total: number, passMark = 40) => ({ studentId, programme, total, passMark });
  it("passes a student only when every result reaches its pass mark", () => {
    expect(passRows(["CSE", "ME"], [
      line(1, "CSE", 40), line(1, "CSE", 75),
      line(2, "CSE", 39), line(2, "CSE", 80),
      line(3, "CSE", 60),
      line(4, "ME", 10),
    ])).toEqual([
      { programme: "CSE", students: 3, passed: 2, percent: 66.7 },
      { programme: "ME", students: 1, passed: 0, percent: 0 },
    ]);
  });
  it("uses each subject's own pass mark and leaves the percent blank with no students", () => {
    expect(passRows(["CSE", "BPH"], [line(1, "CSE", 52, 52), line(2, "CSE", 51, 52)])).toEqual([
      { programme: "BPH", students: 0, passed: 0, percent: null },
      { programme: "CSE", students: 2, passed: 1, percent: 50 },
    ]);
  });
});

describe("scholarshipRows", () => {
  it("counts distinct students per funding source against students not yet alumni", () => {
    expect(scholarshipRows([
      { studentId: 1, fundingSource: "government" },
      { studentId: 1, fundingSource: "government" },
      { studentId: 2, fundingSource: "government" },
      { studentId: 1, fundingSource: "institution" },
    ], 8)).toEqual([
      { source: "Government", benefited: 2, total: 8, percent: 25 },
      { source: "Institution", benefited: 1, total: 8, percent: 12.5 },
      { source: "Non-government", benefited: 0, total: 8, percent: 0 },
    ]);
  });
});

describe("REPORTS", () => {
  it("puts an [A] assumption note on every NAAC report", () => {
    for (const r of REPORTS.filter((x) => x.key.startsWith("naac_"))) {
      expect(r.note, r.key).toContain("[A]");
    }
    expect(REPORTS.find((r) => r.key === "naac_2_6_3")?.note).toContain("Pass mark 40 of 100 [A]");
  });
});
