import { describe, expect, it } from "vitest";
import {
  APPLICANT_CSV_MAX_ROWS,
  applicableDocs,
  checklist,
  checklistComplete,
  checklistProgress,
  parseApplicantsCsv,
} from "./applicants";

const required = [
  { name: "10th marksheet", categories: null },
  { name: "Caste certificate", categories: ["obc", "sc", "st"] },
  { name: "EWS certificate", categories: ["ews"] },
  { name: "Empty list", categories: [] },
];

const HEADER = "name,birth_date,category,guardian_name,guardian_phone,guardian_email";

describe("applicableDocs", () => {
  it("applies null and empty categories to every applicant", () => {
    expect(applicableDocs(required, "general")).toEqual(["10th marksheet", "Empty list"]);
  });
  it("applies category-specific documents only to that category", () => {
    expect(applicableDocs(required, "obc")).toEqual(["10th marksheet", "Caste certificate", "Empty list"]);
    expect(applicableDocs(required, "ews")).toEqual(["10th marksheet", "EWS certificate", "Empty list"]);
  });
});

describe("checklist and completion", () => {
  const applicable = ["10th marksheet", "Aadhaar card", "Passport photo"];

  it("treats a missing document as pending", () => {
    const items = checklist(applicable, [{ name: "10th marksheet", status: "received" }]);
    expect(items.map((i) => i.status)).toEqual(["received", "pending", "pending"]);
    expect(checklistProgress(items)).toEqual({ verified: 0, total: 3 });
    expect(checklistComplete(items)).toBe(false);
  });

  it("is complete only when every applicable document is verified", () => {
    const all = checklist(applicable, applicable.map((name) => ({ name, status: "verified" as const })));
    expect(checklistComplete(all)).toBe(true);
    expect(checklistProgress(all)).toEqual({ verified: 3, total: 3 });
  });

  it("is not complete when one document is only received", () => {
    const items = checklist(applicable, [
      { name: "10th marksheet", status: "verified" },
      { name: "Aadhaar card", status: "verified" },
      { name: "Passport photo", status: "received" },
    ]);
    expect(checklistComplete(items)).toBe(false);
    expect(checklistProgress(items)).toEqual({ verified: 2, total: 3 });
  });

  it("is not complete when no document applies", () => {
    expect(checklistComplete(checklist([], []))).toBe(false);
  });
});

describe("parseApplicantsCsv", () => {
  it("parses rows with a case-insensitive header and optional email", () => {
    const csv = `${HEADER.toUpperCase()}\nAsha Sharma,2007-04-12,General,Ramesh Sharma,9876543210,\n`;
    const result = parseApplicantsCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        name: "Asha Sharma",
        birthDate: "2007-04-12",
        category: "general",
        guardianName: "Ramesh Sharma",
        guardianPhone: "9876543210",
        guardianEmail: null,
        gender: null,
      },
    ]);
  });

  it("reads an optional gender column and rejects an unknown value with its line number", () => {
    const ok = parseApplicantsCsv(`${HEADER},gender\nAsha,2007-04-12,general,Ramesh,9876543210,,Female\n`);
    expect(ok.errors).toEqual([]);
    expect(ok.rows[0].gender).toBe("female");

    const bad = parseApplicantsCsv(`${HEADER},gender\nAsha,2007-04-12,general,Ramesh,9876543210,,x\n`);
    expect(bad.rows).toEqual([]);
    expect(bad.errors).toEqual([{ line: 2, message: expect.stringContaining("gender") }]);
  });

  it("handles quoted fields with commas and doubled quotes", () => {
    const csv = `${HEADER}\n"Sharma, Asha",2007-04-12,obc,"Ramesh ""Raju"" Sharma",9876543210,a@b.in\n`;
    const result = parseApplicantsCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows[0].name).toBe("Sharma, Asha");
    expect(result.rows[0].guardianName).toBe('Ramesh "Raju" Sharma');
    expect(result.rows[0].guardianEmail).toBe("a@b.in");
  });

  it("accepts CRLF line endings and skips blank lines", () => {
    const csv = `${HEADER}\r\n\r\nAsha Sharma,2007-04-12,general,Ramesh,9876543210,\r\n\r\nRohit Das,2006-01-30,sc,Mina Das,9123456780,\r\n`;
    const result = parseApplicantsCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows.map((r) => r.name)).toEqual(["Asha Sharma", "Rohit Das"]);
  });

  it("reports a bad date with its line number", () => {
    const csv = `${HEADER}\nAsha,2007-04-12,general,Ramesh,9876543210,\nRohit,2007-02-30,sc,Mina,9123456780,\n`;
    const result = parseApplicantsCsv(csv);
    expect(result.errors).toEqual([{ line: 3, message: expect.stringContaining("birth_date") }]);
  });

  it("reports an unknown category", () => {
    const result = parseApplicantsCsv(`${HEADER}\nAsha,2007-04-12,gen,Ramesh,9876543210,\n`);
    expect(result.errors).toEqual([{ line: 2, message: expect.stringContaining("category") }]);
  });

  it("reports a missing required value", () => {
    const result = parseApplicantsCsv(`${HEADER}\n,2007-04-12,general,Ramesh,9876543210,\n`);
    expect(result.errors).toEqual([{ line: 2, message: "name is required" }]);
  });

  it("reports a missing column on the header line", () => {
    const result = parseApplicantsCsv("name,birth_date,category,guardian_name\nAsha,2007-04-12,general,Ramesh\n");
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([{ line: 1, message: "Missing column: guardian_phone" }]);
  });

  it("rejects an empty file", () => {
    expect(parseApplicantsCsv("  \n\n").errors).toEqual([{ line: 1, message: "The file is empty" }]);
  });

  it("rejects more than the maximum number of rows", () => {
    const lines = Array.from({ length: APPLICANT_CSV_MAX_ROWS + 1 }, (_, i) => `Name ${i},2007-04-12,general,Ramesh,9876543210,`);
    const result = parseApplicantsCsv([HEADER, ...lines].join("\n"));
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([{ line: APPLICANT_CSV_MAX_ROWS + 2, message: expect.stringContaining("Too many rows") }]);
  });
});
