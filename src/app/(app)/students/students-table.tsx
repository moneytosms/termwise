"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type TableFilter } from "@/components/data-table";
import { AttendanceMeter, StatusPill } from "@/components/page";
import { cn } from "@/lib/utils";
import { rupees } from "@/lib/utils";
import type { StudentRow } from "./queries";

const unique = (xs: string[]) => [...new Set(xs)].sort();

export function StudentsTable({ rows, isAdmin, initialFilters }: { rows: StudentRow[]; isAdmin: boolean; initialFilters: Record<string, string> }) {
  const router = useRouter();
  const columns: ColumnDef<StudentRow>[] = [
    { accessorKey: "name", header: "Student", cell: ({ row: { original: r } }) => (
      <span className="flex items-center gap-3">
        <Initials name={r.name} />
        <span className="min-w-0"><span className="block font-medium">{r.name}</span><span className="block text-xs text-muted-foreground">{r.rollNo}</span></span>
      </span>
    ) },
    { accessorKey: "rollNo", header: "Roll no", meta: { hidden: true } },
    { accessorKey: "batch", header: "Batch", cell: ({ row }) => <span className="text-muted-foreground">{row.original.batch}</span> },
    { accessorKey: "attendance", header: "Attendance", cell: ({ row: { original: r } }) => <AttendanceMeter pct={r.attendance} threshold={r.cutoff} /> },
    { accessorKey: "marks", header: "Marks /40", meta: { align: "right" }, cell: ({ row }) => row.original.marks === null ? <span className="text-muted-foreground">–</span> : row.original.marks },
    ...(isAdmin ? [{ accessorKey: "duePaise", header: "Fee due", meta: { align: "right" }, cell: ({ row }) => <span className={cn(!row.original.duePaise && "text-muted-foreground")}>{rupees(row.original.duePaise ?? 0)}</span> } satisfies ColumnDef<StudentRow>] : []),
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
      emptyTitle="No students here yet."
      mobile={(r) => (
        <span className="flex items-center gap-3">
          <Initials name={r.name} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2"><span className="truncate font-medium">{r.name}</span>{r.flagged && <StatusPill tone="late">Flagged</StatusPill>}</span>
            <span className="block truncate text-[13px] text-muted-foreground">{r.rollNo} · {r.batch}{r.marks !== null && ` · ${r.marks}/40`}{isAdmin && r.duePaise ? ` · ${rupees(r.duePaise)} due` : ""}</span>
          </span>
          <span className={cn("text-sm tabular-nums", r.shortage ? "font-medium text-absent" : "text-foreground")}>{r.attendance === null ? "–" : `${r.attendance.toFixed(1)}%`}</span>
        </span>
      )}
      onRowClick={(r) => router.push(`/students?student=${r.id}`, { scroll: false })} />
  );
}

/** A person's initials on a pale tint of their own hue, stable per name. */
export function Initials({ name }: { name: string }) {
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span className="grid size-8 flex-none place-items-center rounded-full bg-[oklch(0.93_0.035_var(--h))] text-xs font-semibold text-foreground/75 dark:bg-[oklch(0.33_0.045_var(--h))]"
      style={{ "--h": hue } as React.CSSProperties} aria-hidden>
      {name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
    </span>
  );
}
