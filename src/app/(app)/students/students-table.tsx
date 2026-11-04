"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type TableFilter } from "@/components/data-table";
import { StatusPill } from "@/components/page";
import { rupees } from "@/lib/utils";
import type { StudentRow } from "./queries";

const unique = (xs: string[]) => [...new Set(xs)].sort();

export function StudentsTable({ rows, isAdmin, initialFilters }: { rows: StudentRow[]; isAdmin: boolean; initialFilters: Record<string, string> }) {
  const router = useRouter();
  const columns: ColumnDef<StudentRow>[] = [
    { accessorKey: "rollNo", header: "Roll no", cell: ({ row }) => <span className="font-mono text-sm">{row.original.rollNo}</span> },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "batch", header: "Batch" },
    { accessorKey: "attendance", header: "Attendance", cell: ({ row: { original: r } }) => r.attendance === null ? "–" : (
      <span className="flex items-center gap-2"><span className="font-mono">{r.attendance}%</span>{r.shortage && <StatusPill tone="absent">Shortage</StatusPill>}</span>
    ) },
    { accessorKey: "marks", header: "Marks /40", cell: ({ row }) => <span className="font-mono">{row.original.marks ?? "–"}</span> },
    ...(isAdmin ? [{ accessorKey: "duePaise", header: "Fee due", cell: ({ row }) => <span className="font-mono">{rupees(row.original.duePaise ?? 0)}</span> } satisfies ColumnDef<StudentRow>] : []),
    { accessorKey: "flagged", header: "At risk", cell: ({ row }) => row.original.flagged ? <StatusPill tone="late">Flagged</StatusPill> : null },
  ];
  const filters: TableFilter<StudentRow>[] = [
    { label: "Batch", options: unique(rows.map((r) => r.batch)), get: (r) => r.batch },
    { label: "Attendance", options: ["Shortage", "OK"], get: (r) => (r.shortage ? "Shortage" : "OK") },
    { label: "At risk", options: ["Flagged", "Not flagged"], get: (r) => (r.flagged ? "Flagged" : "Not flagged") },
    ...(isAdmin ? [{ label: "Fees", options: ["Due", "Clear"], get: (r: StudentRow) => (r.duePaise ? "Due" : "Clear") }] : []),
  ];
  return (
    <DataTable data={rows} columns={columns} filters={filters} initialFilters={initialFilters}
      searchPlaceholder="Search name or roll number" exportName="students"
      emptyTitle="No students here yet." onRowClick={(r) => router.push(`/students?student=${r.id}`, { scroll: false })} />
  );
}
