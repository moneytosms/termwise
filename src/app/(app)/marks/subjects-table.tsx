"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
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
    { accessorKey: "code", header: "Code", cell: ({ row }) => <span className="font-mono text-sm">{row.original.code}</span> },
    { accessorKey: "name", header: "Subject" },
    { accessorKey: "batch", header: "Batch" },
    { accessorKey: "faculty", header: "Faculty", cell: ({ row }) => row.original.faculty ?? "Unassigned" },
    { id: "status", accessorFn: (r) => STATUS[r.status].label, header: "Status", cell: ({ row }) => (
      <StatusPill tone={STATUS[row.original.status].tone}>{STATUS[row.original.status].label}</StatusPill>
    ) },
    { id: "marks", accessorFn: (r) => `${r.filled}/${r.needed}`, header: "Marks entered", cell: ({ row }) => (
      <span className="font-mono">{row.original.filled}/{row.original.needed}</span>
    ) },
  ];
  const filters: TableFilter<SubjectRow>[] = [
    { label: "Status", options: Object.values(STATUS).map((s) => s.label), get: (r) => STATUS[r.status].label },
    { label: "Batch", options: unique(rows.map((r) => r.batch)), get: (r) => r.batch },
  ];
  return (
    <DataTable data={rows} columns={columns} filters={filters} initialFilters={initialFilters}
      searchPlaceholder="Search subject or code" emptyTitle="No subjects on this campus yet." emptyAction={emptyAction}
      onRowClick={(r) => router.push(`/marks/${r.id}`)} />
  );
}
