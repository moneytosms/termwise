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
    { accessorKey: "kind", header: "Kind", cell: ({ row }) => KIND_LABEL[row.original.kind] },
    { accessorKey: "submitter", header: "Submitted by" },
    { accessorKey: "classLabel", header: "Class" },
    { accessorKey: "date", header: "Date", cell: ({ row }) => <span className="font-mono text-sm">{row.original.date}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill tone={CONFLICT_STATUS[row.original.status].tone}>{CONFLICT_STATUS[row.original.status].label}</StatusPill> },
  ];
  return (
    <DataTable data={rows} columns={columns} searchPlaceholder="Search class or teacher" emptyTitle="No conflicts to resolve."
      onRowClick={(r) => router.push(`/attendance?${base}&conflict=${r.id}`, { scroll: false })} />
  );
}
