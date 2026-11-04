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
    { accessorKey: "at", header: "Time (IST)", cell: ({ row }) => <span className="whitespace-nowrap font-mono text-xs">{ist(row.original.at)}</span> },
    { accessorKey: "actor", header: "Actor" },
    { accessorKey: "action", header: "Action", cell: ({ row }) => <span className="font-mono text-xs">{row.original.action}</span> },
    { accessorKey: "entity", header: "Entity" },
    { accessorKey: "entityId", header: "Entity id", cell: ({ row }) => <span className="font-mono text-xs">{row.original.entityId}</span> },
    { accessorKey: "reason", header: "Reason", cell: ({ row }) => row.original.reason || "–" },
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
        emptyTitle="No changes recorded yet." onRowClick={(r) => router.push(`/audit?entry=${r.id}`, { scroll: false })} />
      <Sheet open={!!entry} onOpenChange={(o) => { if (!o) router.push("/audit", { scroll: false }); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {entry && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono text-base">{entry.action}</SheetTitle>
                <SheetDescription>{ist(entry.at)} · {entry.actor}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-4 text-sm">
                <p>{entry.entity} <span className="font-mono text-xs">{entry.entityId}</span></p>
                <p className="text-muted-foreground">{entry.reason || "No reason given."}</p>
                <div>
                  <h3 className="mb-1 font-medium">Old values</h3>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">{json(entry.oldValue)}</pre>
                </div>
                <div>
                  <h3 className="mb-1 font-medium">New values</h3>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">{json(entry.newValue)}</pre>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
