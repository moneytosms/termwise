"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Progress } from "@/components/charts";
import { DataTable, type TableFilter } from "@/components/data-table";
import { StatusPill } from "@/components/page";
import type { SubjectRow } from "./queries";
import { STATUS } from "./shared";

const unique = (xs: string[]) => [...new Set(xs)].sort();

export function SubjectsTable({ rows, initialFilters, emptyAction }: {
  rows: SubjectRow[]; initialFilters: Record<string, string>; emptyAction: React.ReactNode;
}) {
  const router = useRouter();
  const columns: ColumnDef<SubjectRow>[] = [
    { accessorKey: "name", header: "Subject", cell: ({ row: { original: r } }) => <span><span className="block font-medium">{r.name}</span><span className="block text-xs text-muted-foreground">{r.code} · {r.batch}</span></span> },
    { accessorKey: "code", header: "Code", meta: { hidden: true } },
    { accessorKey: "batch", header: "Batch", meta: { hidden: true } },
    { accessorKey: "faculty", header: "Faculty", cell: ({ row }) => <span className="text-muted-foreground">{row.original.faculty ?? "Unassigned"}</span> },
    { id: "status", accessorFn: (r) => STATUS[r.status].label, header: "Status", cell: ({ row }) => (
      <StatusPill tone={STATUS[row.original.status].tone}>{STATUS[row.original.status].label}</StatusPill>
    ) },
    { id: "marks", accessorFn: (r) => `${r.filled}/${r.needed}`, header: "Marks entered", cell: ({ row: { original: r } }) => <Progress filled={r.filled} needed={r.needed} /> },
  ];
  const filters: TableFilter<SubjectRow>[] = [
    { label: "Status", options: Object.values(STATUS).map((s) => s.label), get: (r) => STATUS[r.status].label },
    { label: "Batch", options: unique(rows.map((r) => r.batch)), get: (r) => r.batch },
  ];
  return (
    <DataTable data={rows} columns={columns} filters={filters} initialFilters={initialFilters}
      searchPlaceholder="Search subject or code" emptyTitle="No subjects on this campus yet." emptyAction={emptyAction}
      mobile={(r) => (
        <span className="block">
          <span className="flex items-center justify-between gap-3"><span className="truncate font-medium">{r.name}</span><StatusPill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusPill></span>
          <span className="mt-1 flex items-center justify-between gap-3 text-[13px] text-muted-foreground"><span className="truncate">{r.code} · {r.batch} · {r.faculty ?? "Unassigned"}</span><Progress filled={r.filled} needed={r.needed} /></span>
        </span>
      )}
      onRowClick={(r) => router.push(`/marks/${r.id}`)} />
  );
}
