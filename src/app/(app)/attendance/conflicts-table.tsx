"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { StatusPill } from "@/components/page";
import { CONFLICT_STATUS, KIND_LABEL } from "./shared";
import type { ConflictRow } from "./queries";

export function ConflictsTable({ rows, base }: { rows: ConflictRow[]; base: string }) {
  const router = useRouter();
  const columns: ColumnDef<ConflictRow>[] = [
    { accessorKey: "classLabel", header: "Class", cell: ({ row }) => <span className="font-medium">{row.original.classLabel}</span> },
    { accessorKey: "kind", header: "Kind", cell: ({ row }) => KIND_LABEL[row.original.kind] },
    { accessorKey: "submitter", header: "Submitted by", cell: ({ row }) => <span className="text-muted-foreground">{row.original.submitter}</span> },
    { accessorKey: "date", header: "Date", cell: ({ row }) => <span className="text-muted-foreground">{row.original.date}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill tone={CONFLICT_STATUS[row.original.status].tone}>{CONFLICT_STATUS[row.original.status].label}</StatusPill> },
  ];
  return (
    <DataTable data={rows} columns={columns} searchPlaceholder="Search class or teacher" emptyTitle="No conflicts to resolve."
      mobile={(r) => (
        <span className="block">
          <span className="flex items-center justify-between gap-3"><span className="truncate font-medium">{r.classLabel}</span><StatusPill tone={CONFLICT_STATUS[r.status].tone}>{CONFLICT_STATUS[r.status].label}</StatusPill></span>
          <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{KIND_LABEL[r.kind]} · {r.submitter} · {r.date}</span>
        </span>
      )}
      onRowClick={(r) => router.push(`/attendance?${base}&conflict=${r.id}`, { scroll: false })} />
  );
}
