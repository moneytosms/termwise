"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type TableFilter } from "@/components/data-table";
import { StatusPill } from "@/components/page";
import { SOURCE, TASK } from "./labels";
import type { RiskRow } from "./queries";

const unique = (xs: string[]) => [...new Set(xs)].sort();
const TASK_TONE: Record<string, "late" | "ok" | "default"> = { Open: "late", Done: "ok", Dismissed: "default" };

export function RiskTable({ rows }: { rows: RiskRow[] }) {
  const router = useRouter();
  const columns: ColumnDef<RiskRow>[] = [
    { accessorKey: "rollNo", header: "Roll no", cell: ({ row }) => <span className="font-mono text-sm">{row.original.rollNo}</span> },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "batch", header: "Batch" },
    { accessorKey: "reason", header: "Reason", cell: ({ row }) => <span className="block max-w-md whitespace-normal">{row.original.reason}</span> },
    { accessorKey: "source", header: "Reason source" },
    { accessorKey: "mentor", header: "Mentor" },
    { accessorKey: "task", header: "Task status", cell: ({ row: { original: r } }) => r.task === "–"
      ? <span className="text-muted-foreground">–</span> : <StatusPill tone={TASK_TONE[r.task]}>{r.task}</StatusPill> },
    { accessorKey: "flaggedOn", header: "Flagged", cell: ({ row }) => <span className="font-mono text-sm">{row.original.flaggedOn}</span> },
  ];
  const filters: TableFilter<RiskRow>[] = [
    { label: "Batch", options: unique(rows.map((r) => r.batch)), get: (r) => r.batch },
    { label: "Task status", options: Object.values(TASK), get: (r) => r.task },
    { label: "Reason source", options: Object.values(SOURCE), get: (r) => r.source },
  ];
  return (
    <DataTable data={rows} columns={columns} filters={filters} searchPlaceholder="Search name or roll number"
      exportName="at-risk" emptyTitle="No students flagged. Run the check to update."
      onRowClick={(r) => router.push(`/students?student=${r.studentId}`, { scroll: false })} />
  );
}
