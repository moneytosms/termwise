"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { RegisterBar } from "@/components/charts";
import { DataTable, type TableFilter } from "@/components/data-table";
import type { SessionRow } from "./queries";

const unique = (xs: string[]) => [...new Set(xs)].sort();

export function SessionsTable({ rows, base }: { rows: SessionRow[]; base: string }) {
  const router = useRouter();
  const columns: ColumnDef<SessionRow>[] = [
    { accessorKey: "subject", header: "Subject", cell: ({ row: { original: r } }) => (
      <span className="block"><span className="block font-medium">{r.subject}</span><span className="block text-xs text-muted-foreground">{r.batch} · Period {r.period}</span></span>
    ) },
    { accessorKey: "date", header: "Date", cell: ({ row }) => <span className="text-muted-foreground">{row.original.date}</span> },
    { accessorKey: "batch", header: "Batch", meta: { hidden: true } },
    { accessorKey: "period", header: "Period", meta: { hidden: true } },
    { accessorKey: "faculty", header: "Faculty" },
    { id: "register", header: "Register", enableSorting: false, cell: ({ row: { original: r } }) => <RegisterBar present={r.present} late={r.late} absent={r.absent} /> },
    { accessorKey: "present", header: "Present", meta: { align: "right" } },
    { accessorKey: "absent", header: "Absent", meta: { align: "right" }, cell: ({ row }) => <span className={row.original.absent ? "font-medium" : "text-muted-foreground"}>{row.original.absent}</span> },
    { accessorKey: "late", header: "Late", meta: { align: "right" }, cell: ({ row }) => <span className={row.original.late ? "" : "text-muted-foreground"}>{row.original.late}</span> },
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
      mobile={(r) => (
        <span className="block">
          <span className="flex items-center justify-between gap-3"><span className="truncate font-medium">{r.subject}</span><span className="text-sm tabular-nums">{r.present}<span className="text-muted-foreground">/{r.present + r.absent + r.late}</span></span></span>
          <span className="mt-0.5 flex items-center justify-between gap-3 text-[13px] text-muted-foreground"><span className="truncate">{r.date} · {r.batch} · P{r.period} · {r.faculty}</span>{r.absent > 0 && <span className="shrink-0 text-absent">{r.absent} absent</span>}</span>
        </span>
      )}
      onRowClick={(r) => router.push(`/attendance?${base}&session=${r.id}`, { scroll: false })} />
  );
}
