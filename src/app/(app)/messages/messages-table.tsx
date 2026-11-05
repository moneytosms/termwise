"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type TableFilter } from "@/components/data-table";
import { StatusPill } from "@/components/page";
import { KIND, LANGUAGE, STATUS } from "./labels";
import type { MessageRow } from "./queries";

const dateTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export function MessagesTable({ rows }: { rows: MessageRow[] }) {
  const router = useRouter();
  const columns: ColumnDef<MessageRow>[] = [
    { accessorKey: "name", header: "Student", cell: ({ row: { original: r } }) => <span><span className="block font-medium">{r.name}</span><span className="block text-xs text-muted-foreground">{r.rollNo}</span></span> },
    { accessorKey: "rollNo", header: "Roll no", meta: { hidden: true } },
    { accessorKey: "at", header: "Date", cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{dateTime(row.original.at)}</span> },
    { accessorKey: "kind", header: "Kind" },
    { accessorKey: "language", header: "Language", cell: ({ row: { original: r } }) => r.language === "Odia"
      ? <span className="flex flex-wrap items-center gap-2">Odia<StatusPill tone="late">Needs native review</StatusPill></span> : "English" },
    { accessorKey: "status", header: "Status", cell: ({ row: { original: r } }) => r.status === STATUS.logged
      ? <StatusPill tone="ok">{r.status}</StatusPill> : <StatusPill tone="absent">{r.status}</StatusPill> },
    { accessorKey: "body", header: "Body", cell: ({ row }) => <span className="block max-w-xs truncate text-muted-foreground" title={row.original.body}>{row.original.body}</span> },
  ];
  const filters: TableFilter<MessageRow>[] = [
    { label: "Kind", options: Object.values(KIND), get: (r) => r.kind },
    { label: "Language", options: Object.values(LANGUAGE), get: (r) => r.language },
    { label: "Status", options: Object.values(STATUS), get: (r) => r.status },
  ];
  return (
    <DataTable data={rows} columns={columns} filters={filters} searchPlaceholder="Search name or roll number"
      exportName="messages" emptyTitle="No messages yet. They appear after the daily check runs."
      mobile={(r) => (
        <span className="block">
          <span className="flex items-center justify-between gap-3"><span className="truncate font-medium">{r.name}</span><StatusPill tone={r.status === STATUS.logged ? "ok" : "absent"}>{r.status}</StatusPill></span>
          <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{r.rollNo} · {r.kind} · {r.language} · {dateTime(r.at)}</span>
          <span className="block truncate text-[13px] text-muted-foreground">{r.body}</span>
        </span>
      )}
      onRowClick={(r) => router.push(`/messages?message=${r.id}`, { scroll: false })} />
  );
}
