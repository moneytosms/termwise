"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type TableFilter } from "@/components/data-table";
import type { SessionRow } from "./queries";

const unique = (xs: string[]) => [...new Set(xs)].sort();

export function SessionsTable({ rows, base }: { rows: SessionRow[]; base: string }) {
  const router = useRouter();
  const columns: ColumnDef<SessionRow>[] = [
    { accessorKey: "date", header: "Date", cell: ({ row }) => <span className="font-mono text-sm">{row.original.date}</span> },
    { accessorKey: "period", header: "Period", cell: ({ row }) => <span className="font-mono">{row.original.period}</span> },
    { accessorKey: "batch", header: "Batch" },
    { accessorKey: "subject", header: "Subject" },
    { accessorKey: "faculty", header: "Faculty" },
    { accessorKey: "present", header: "Present", cell: ({ row }) => <span className="font-mono">{row.original.present}</span> },
    { accessorKey: "absent", header: "Absent", cell: ({ row }) => <span className="font-mono">{row.original.absent}</span> },
    { accessorKey: "late", header: "Late", cell: ({ row }) => <span className="font-mono">{row.original.late}</span> },
    { accessorKey: "editedAt", header: "Last edited", cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.editedAt}</span> },
  ];
  const filters: TableFilter<SessionRow>[] = [
    { label: "Batch", options: unique(rows.map((r) => r.batch)), get: (r) => r.batch },
    { label: "Subject", options: unique(rows.map((r) => r.subject)), get: (r) => r.subject },
    { label: "Date", options: ["Today", "Last 7 days", "Older"], get: (r) => r.bucket },
  ];
  return (
    <DataTable data={rows} columns={columns} filters={filters}
      searchPlaceholder="Search subject or faculty" emptyTitle="No attendance sessions yet."
      onRowClick={(r) => router.push(`/attendance?${base}&session=${r.id}`, { scroll: false })} />
  );
}
