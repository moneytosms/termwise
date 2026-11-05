"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Initials } from "../students/students-table";
import { DataTable, type TableFilter } from "@/components/data-table";
import { StatusPill, type Tone } from "@/components/page";
import { Button } from "@/components/ui/button";
import { rupees } from "@/lib/utils";
import { sendFeeReminders } from "./actions";
import type { FeeRow, FeeStatus } from "./queries";

const unique = (xs: string[]) => [...new Set(xs)].sort();
const TONE: Record<FeeStatus, Tone> = { Clear: "ok", Due: "late", Overdue: "absent" };

function RemindButton({ ids, clear }: { ids: number[]; clear: () => void }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const send = () => start(async () => {
    const r = await sendFeeReminders(ids);
    if (r.error) { toast.error(r.error); return; }
    const { logged = 0, blocked = 0, skipped = 0 } = r;
    toast.success(`${logged} reminders logged, ${blocked} blocked (no parent consent)${skipped ? `, ${skipped} skipped (nothing due)` : ""}.`);
    clear();
    router.refresh();
  });
  return <Button size="sm" disabled={busy} onClick={send}>Send reminder</Button>;
}

export function FeesTable({ rows, initialFilters }: { rows: FeeRow[]; initialFilters: Record<string, string> }) {
  const router = useRouter();
  const columns: ColumnDef<FeeRow>[] = [
    { accessorKey: "name", header: "Student", cell: ({ row: { original: r } }) => (
      <span className="flex items-center gap-3"><Initials name={r.name} /><span><span className="block font-medium">{r.name}</span><span className="block text-xs text-muted-foreground">{r.rollNo}</span></span></span>
    ) },
    { accessorKey: "rollNo", header: "Roll no", meta: { hidden: true } },
    { accessorKey: "batch", header: "Batch", cell: ({ row }) => <span className="text-muted-foreground">{row.original.batch}</span> },
    { accessorKey: "nextDue", header: "Next due", cell: ({ row }) => <span className="text-muted-foreground">{row.original.nextDue ?? "–"}</span> },
    { id: "due", accessorFn: (r) => r.duePaise / 100, header: "Total due", meta: { align: "right" }, cell: ({ row }) => <span className={row.original.duePaise ? "font-semibold" : "text-muted-foreground"}>{rupees(row.original.duePaise)}</span> },
    { id: "overdue", accessorFn: (r) => r.overduePaise / 100, header: "Overdue", meta: { align: "right" }, cell: ({ row }) => <span className={row.original.overduePaise ? "font-medium text-absent" : "text-muted-foreground"}>{rupees(row.original.overduePaise)}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill tone={TONE[row.original.status]}>{row.original.status}</StatusPill> },
  ];
  const filters: TableFilter<FeeRow>[] = [
    { label: "Batch", options: unique(rows.map((r) => r.batch)), get: (r) => r.batch },
    { label: "Status", options: ["Clear", "Due", "Overdue"], get: (r) => r.status },
  ];
  return (
    <DataTable data={rows} columns={columns} filters={filters} initialFilters={initialFilters}
      searchPlaceholder="Search name or roll number" exportName="fee-dues" pageSize={20}
      bulkActions={(selected, clear) => <RemindButton ids={selected.map((r) => r.id)} clear={clear} />}
      emptyTitle="No fee records yet." rowNav={{ key: "fees", id: (r) => String(r.id) }}
      mobile={(r) => (
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.name}</span><span className="block truncate text-[13px] text-muted-foreground">{r.rollNo} · {r.batch}{r.nextDue && ` · next ${r.nextDue}`}</span></span>
          <span className="text-right"><span className="block font-semibold tabular-nums">{rupees(r.duePaise)}</span><StatusPill tone={TONE[r.status]}>{r.status}</StatusPill></span>
        </span>
      )}
      onRowClick={(r) => router.push(`/fees?student=${r.id}`, { scroll: false })} />
  );
}
