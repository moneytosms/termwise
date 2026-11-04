"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
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
    { accessorKey: "rollNo", header: "Roll no", cell: ({ row }) => <span className="font-mono text-sm">{row.original.rollNo}</span> },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "batch", header: "Batch" },
    { id: "due", accessorFn: (r) => r.duePaise / 100, header: "Total due", cell: ({ row }) => <span className="font-mono">{rupees(row.original.duePaise)}</span> },
    { id: "overdue", accessorFn: (r) => r.overduePaise / 100, header: "Overdue", cell: ({ row }) => <span className="font-mono">{rupees(row.original.overduePaise)}</span> },
    { accessorKey: "nextDue", header: "Next due date", cell: ({ row }) => <span className="font-mono text-sm">{row.original.nextDue ?? "–"}</span> },
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
      emptyTitle="No fee records yet."
      onRowClick={(r) => router.push(`/fees?student=${r.id}`, { scroll: false })} />
  );
}
