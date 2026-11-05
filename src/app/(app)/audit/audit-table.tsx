"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type TableFilter } from "@/components/data-table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export type AuditRow = {
  id: number; at: string; actor: string; action: string; entity: string; entityId: string; reason: string;
  oldValue: unknown; newValue: unknown;
};

const unique = (xs: string[]) => [...new Set(xs)].sort();
const ist = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium" });
const json = (v: unknown) => JSON.stringify(v, null, 2) ?? "null";

export function AuditTable({ rows, selectedId }: { rows: AuditRow[]; selectedId?: string }) {
  const router = useRouter();
  const columns: ColumnDef<AuditRow>[] = [
    { accessorKey: "action", header: "Change", cell: ({ row: { original: r } }) => <span><span className="block font-code text-[13px]">{r.action}</span><span className="block text-xs text-muted-foreground">{r.entity} <span className="font-code">{r.entityId}</span></span></span> },
    { accessorKey: "actor", header: "By" },
    { accessorKey: "at", header: "Time (IST)", cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{ist(row.original.at)}</span> },
    { accessorKey: "entity", header: "Entity", meta: { hidden: true } },
    { accessorKey: "entityId", header: "Entity id", meta: { hidden: true } },
    { accessorKey: "reason", header: "Reason", cell: ({ row }) => row.original.reason ? <span className="block max-w-sm truncate">{row.original.reason}</span> : <span className="text-muted-foreground">–</span> },
  ];
  const filters: TableFilter<AuditRow>[] = [
    { label: "Action", options: unique(rows.map((r) => r.action)), get: (r) => r.action },
    { label: "Entity", options: unique(rows.map((r) => r.entity)), get: (r) => r.entity },
    { label: "Actor", options: unique(rows.map((r) => r.actor)), get: (r) => r.actor },
  ];
  const entry = rows.find((r) => String(r.id) === selectedId);

  return (
    <>
      <DataTable data={rows} columns={columns} filters={filters} exportName="audit-log" searchPlaceholder="Search changes"
        emptyTitle="No changes recorded yet."
        mobile={(r) => (
          <span className="block">
            <span className="flex items-center justify-between gap-3"><span className="truncate font-code text-[13px]">{r.action}</span><span className="shrink-0 text-xs text-muted-foreground">{ist(r.at)}</span></span>
            <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{r.actor} · {r.entity} {r.entityId}{r.reason && ` · ${r.reason}`}</span>
          </span>
        )}
        onRowClick={(r) => router.push(`/audit?entry=${r.id}`, { scroll: false })} />
      <Sheet open={!!entry} onOpenChange={(o) => { if (!o) router.push("/audit", { scroll: false }); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {entry && (
            <>
              <SheetHeader>
                <SheetTitle className="font-code text-base">{entry.action}</SheetTitle>
                <SheetDescription>{ist(entry.at)} · {entry.actor}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-4 text-sm">
                <p>{entry.entity} <span className="font-code text-xs">{entry.entityId}</span></p>
                <p className="text-muted-foreground">{entry.reason || "No reason given."}</p>
                <div>
                  <h3 className="mb-1 font-medium">Old values</h3>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-code text-xs">{json(entry.oldValue)}</pre>
                </div>
                <div>
                  <h3 className="mb-1 font-medium">New values</h3>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-code text-xs">{json(entry.newValue)}</pre>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
