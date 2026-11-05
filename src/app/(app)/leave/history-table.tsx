"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type TableFilter } from "@/components/data-table";
import { StatusPill } from "@/components/page";
import { KIND_LABEL, type LeaveKind, type LeaveStatus } from "@/domain/staff-leave";
import { STATUS_LABEL, STATUS_TONE, fmtDays, fmtRange } from "./shared";
import { WithdrawButton } from "./leave-forms";

export type HistoryRow = {
  id: number; kind: LeaveKind; fromDate: string; toDate: string; reason: string; status: LeaveStatus; note: string | null;
};

export function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  const columns: ColumnDef<HistoryRow>[] = [
    { accessorKey: "kind", header: "Type", cell: ({ row }) => KIND_LABEL[row.original.kind] },
    { accessorKey: "fromDate", header: "Dates", cell: ({ row: { original: r } }) => (
      <span className="whitespace-nowrap tabular-nums">{fmtRange(r.fromDate, r.toDate)} <span className="text-muted-foreground">· {fmtDays(r.fromDate, r.toDate)}</span></span>
    ) },
    { accessorKey: "reason", header: "Reason", cell: ({ row }) => <span className="block max-w-xs truncate text-muted-foreground" title={row.original.reason}>{row.original.reason}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row: { original: r } }) => <StatusPill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusPill> },
    { accessorKey: "note", header: "Office note", cell: ({ row }) => <span className="block max-w-xs truncate text-muted-foreground" title={row.original.note ?? undefined}>{row.original.note ?? "–"}</span> },
    { id: "action", header: "", enableSorting: false, cell: ({ row: { original: r } }) => r.status === "pending" ? <WithdrawButton id={r.id} /> : null },
  ];
  const filters: TableFilter<HistoryRow>[] = [
    { label: "Status", options: Object.values(STATUS_LABEL), get: (r) => STATUS_LABEL[r.status] },
  ];
  return (
    <DataTable data={rows} columns={columns} filters={filters} searchPlaceholder="Search reason"
      emptyTitle="No leave applied for yet."
      mobile={(r) => (
        <span className="block">
          <span className="flex items-center justify-between gap-3">
            <span className="truncate font-medium">{KIND_LABEL[r.kind]}</span>
            <StatusPill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusPill>
          </span>
          <span className="mt-0.5 block text-[13px] text-muted-foreground tabular-nums">{fmtRange(r.fromDate, r.toDate)} · {fmtDays(r.fromDate, r.toDate)}</span>
          <span className="block truncate text-[13px] text-muted-foreground">{r.reason}</span>
          {r.note && <span className="block text-[13px]">Office note: {r.note}</span>}
          {r.status === "pending" && <span className="mt-2 block"><WithdrawButton id={r.id} /></span>}
        </span>
      )} />
  );
}
