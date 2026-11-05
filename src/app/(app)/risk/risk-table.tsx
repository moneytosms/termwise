"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Initials } from "../students/students-table";
import { DataTable, type TableFilter } from "@/components/data-table";
import { StatusPill } from "@/components/page";
import { SOURCE, TASK } from "./labels";
import type { RiskRow } from "./queries";

const unique = (xs: string[]) => [...new Set(xs)].sort();
const TASK_TONE: Record<string, "late" | "ok" | "default"> = { Open: "late", Done: "ok", Dismissed: "default" };

export function RiskTable({ rows }: { rows: RiskRow[] }) {
  const router = useRouter();
  const columns: ColumnDef<RiskRow>[] = [
    { accessorKey: "name", header: "Student", cell: ({ row: { original: r } }) => (
      <span className="flex items-center gap-3"><Initials name={r.name} /><span><span className="block font-medium">{r.name}</span><span className="block text-xs text-muted-foreground">{r.rollNo} · {r.batch}</span></span></span>
    ) },
    { accessorKey: "rollNo", header: "Roll no", meta: { hidden: true } },
    { accessorKey: "batch", header: "Batch", meta: { hidden: true } },
    { accessorKey: "reason", header: "Reason", cell: ({ row: { original: r } }) => <span className="block max-w-md whitespace-normal"><span className="block">{r.reason}</span><span className="block text-xs text-muted-foreground">{r.source}</span></span> },
    { accessorKey: "source", header: "Reason source", meta: { hidden: true } },
    { accessorKey: "mentor", header: "Mentor", cell: ({ row }) => <span className="text-muted-foreground">{row.original.mentor}</span> },
    { accessorKey: "task", header: "Task status", cell: ({ row: { original: r } }) => r.task === "–"
      ? <span className="text-muted-foreground">–</span> : <StatusPill tone={TASK_TONE[r.task]}>{r.task}</StatusPill> },
    { accessorKey: "flaggedOn", header: "Flagged", cell: ({ row }) => <span className="text-muted-foreground">{row.original.flaggedOn}</span> },
  ];
  const filters: TableFilter<RiskRow>[] = [
    { label: "Batch", options: unique(rows.map((r) => r.batch)), get: (r) => r.batch },
    { label: "Task status", options: Object.values(TASK), get: (r) => r.task },
    { label: "Reason source", options: Object.values(SOURCE), get: (r) => r.source },
  ];
  return (
    <DataTable data={rows} columns={columns} filters={filters} searchPlaceholder="Search name or roll number"
      exportName="at-risk" emptyTitle="No students flagged. Run the check to update."
      mobile={(r) => (
        <span className="block">
          <span className="flex items-center justify-between gap-3"><span className="truncate font-medium">{r.name}</span>{r.task !== "–" && <StatusPill tone={TASK_TONE[r.task]}>{r.task}</StatusPill>}</span>
          <span className="mt-0.5 block text-[13px] text-muted-foreground">{r.reason}</span>
          <span className="block truncate text-xs text-muted-foreground">{r.rollNo} · {r.mentor} · {r.flaggedOn}</span>
        </span>
      )}
      onRowClick={(r) => router.push(`/students?student=${r.studentId}`, { scroll: false })} />
  );
}
