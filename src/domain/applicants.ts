export const APPLICANT_CATEGORIES = ["general", "obc", "sc", "st", "ews"] as const;
export type ApplicantCategory = (typeof APPLICANT_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<ApplicantCategory, string> = {
  general: "General",
  obc: "OBC",
  sc: "SC",
  st: "ST",
  ews: "EWS",
};

export type DocStatus = "pending" | "received" | "verified";

export type RequiredDoc = { name: string; categories: string[] | null };
export type DocState = { name: string; status: DocStatus };

// Names of the required documents that apply to an applicant's category; null or empty categories means every category
export function applicableDocs(required: RequiredDoc[], category: string): string[] {
  return required
    .filter((d) => !d.categories || d.categories.length === 0 || d.categories.includes(category))
    .map((d) => d.name);
}

// One item per applicable document; a document without a stored row is pending
export function checklist(applicable: string[], statuses: DocState[]): DocState[] {
  return applicable.map((name) => ({
    name,
    status: statuses.find((s) => s.name === name)?.status ?? "pending",
  }));
}

export function checklistProgress(items: DocState[]): { verified: number; total: number } {
  return { verified: items.filter((i) => i.status === "verified").length, total: items.length };
}

// Complete only when at least one document applies and every applicable one is verified
export function checklistComplete(items: DocState[]): boolean {
  return items.length > 0 && items.every((i) => i.status === "verified");
}

export const APPLICANT_CSV_TEMPLATE =
  "name,birth_date,category,guardian_name,guardian_phone,guardian_email\n" +
  "Asha Sharma,2007-04-12,general,Ramesh Sharma,9876543210,ramesh.sharma@example.com\n";

export const APPLICANT_CSV_MAX_ROWS = 500;

export type ApplicantRow = {
  name: string;
  birthDate: string;
  category: ApplicantCategory;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string | null;
};

export type CsvIssue = { line: number; message: string };

const REQUIRED_COLUMNS = ["name", "birth_date", "category", "guardian_name", "guardian_phone"] as const;

type CsvRecord = { line: number; fields: string[] };

// RFC 4180 style reader: quoted fields may hold commas, newlines and "" escapes; blank records are dropped
function readCsv(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;

  const endRecord = () => {
    fields.push(field);
    if (fields.some((f) => f.trim() !== "")) records.push({ line: recordLine, fields: fields.map((f) => f.trim()) });
    fields = [];
    field = "";
  };

  const body = text.replace(/^﻿/, "");
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inQuotes) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(field);
      field = "";
    } else if (ch === "\r") {
      // ignored; CRLF ends the record on the \n
    } else if (ch === "\n") {
      endRecord();
      line++;
      recordLine = line;
    } else {
      field += ch;
    }
  }
  endRecord();
  return records;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function parseApplicantsCsv(text: string): { rows: ApplicantRow[]; errors: CsvIssue[] } {
  const records = readCsv(text);
  if (records.length === 0) return { rows: [], errors: [{ line: 1, message: "The file is empty" }] };

  const header = records[0].fields.map((f) => f.toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return { rows: [], errors: [{ line: records[0].line, message: `Missing column: ${missing.join(", ")}` }] };
  }

  const data = records.slice(1);
  if (data.length > APPLICANT_CSV_MAX_ROWS) {
    return {
      rows: [],
      errors: [{ line: data[APPLICANT_CSV_MAX_ROWS].line, message: `Too many rows (maximum ${APPLICANT_CSV_MAX_ROWS})` }],
    };
  }

  const rows: ApplicantRow[] = [];
  const errors: CsvIssue[] = [];
  for (const record of data) {
    const cell = (column: string) => {
      const index = header.indexOf(column);
      return index === -1 ? "" : (record.fields[index] ?? "");
    };
    const before = errors.length;

    for (const column of REQUIRED_COLUMNS) {
      if (cell(column) === "") errors.push({ line: record.line, message: `${column} is required` });
    }

    const birthDate = cell("birth_date");
    if (birthDate !== "" && !isCalendarDate(birthDate)) {
      errors.push({ line: record.line, message: `birth_date "${birthDate}" must be a date as YYYY-MM-DD` });
    }

    const category = cell("category").toLowerCase();
    const isKnownCategory = (APPLICANT_CATEGORIES as readonly string[]).includes(category);
    if (category !== "" && !isKnownCategory) {
      errors.push({ line: record.line, message: `category "${cell("category")}" must be one of general, obc, sc, st, ews` });
    }

    if (errors.length === before) {
      rows.push({
        name: cell("name"),
        birthDate,
        category: category as ApplicantCategory,
        guardianName: cell("guardian_name"),
        guardianPhone: cell("guardian_phone"),
        guardianEmail: cell("guardian_email") || null,
      });
    }
  }

  return { rows, errors };
}
