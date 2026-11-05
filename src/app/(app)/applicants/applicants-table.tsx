"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type TableFilter } from "@/components/data-table";
import { StatusPill, type Tone } from "@/components/page";
import { CATEGORY_LABEL, type ApplicantCategory } from "@/domain/applicants";
import { Initials } from "../students/students-table";
import type { ApplicantRow } from "./queries";

const unique = (xs: string[]) => [...new Set(xs)].sort();

const STATUS: Record<ApplicantRow["status"], { label: string; tone: Tone }> = {
  applied: { label: "Applied", tone: "default" },
  confirmed: { label: "Confirmed", tone: "ok" },
  rejected: { label: "Rejected", tone: "absent" },
};

const progress = (r: ApplicantRow) => `${r.verified}/${r.total}`;

export function ApplicantsTable({ rows, initialFilters }: { rows: ApplicantRow[]; initialFilters: Record<string, string> }) {
  const router = useRouter();
  const columns: ColumnDef<ApplicantRow>[] = [
    { accessorKey: "name", header: "Applicant", cell: ({ row: { original: r } }) => (
      <span className="flex items-center gap-3">
        <Initials name={r.name} />
        <span className="block font-medium">{r.name}</span>
      </span>
    ) },
    { accessorKey: "programme", header: "Programme", cell: ({ row }) => <span className="tabular-nums text-sm">{row.original.programme}</span> },
    { accessorKey: "batch", header: "Batch", cell: ({ row }) => <span className="text-muted-foreground">{row.original.batch}</span> },
    { accessorKey: "category", header: "Category", cell: ({ row }) => CATEGORY_LABEL[row.original.category as ApplicantCategory] ?? row.original.category },
    { id: "checklist", header: "Checklist", meta: { align: "right" }, cell: ({ row: { original: r } }) => (
      <span className={r.complete ? "tabular-nums text-ok" : "tabular-nums"}>{progress(r)}</span>
    ) },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill tone={STATUS[row.original.status].tone}>{STATUS[row.original.status].label}</StatusPill> },
  ];
  const filters: TableFilter<ApplicantRow>[] = [
    { label: "Programme", options: unique(rows.map((r) => r.programme)), get: (r) => r.programme },
    { label: "Status", options: ["Applied", "Confirmed", "Rejected"], get: (r) => STATUS[r.status].label },
    { label: "Checklist", options: ["Incomplete", "Complete"], get: (r) => (r.complete ? "Complete" : "Incomplete") },
  ];
  return (
    <DataTable data={rows} columns={columns} filters={filters} initialFilters={initialFilters}
      searchPlaceholder="Search name" exportName="applicants"
      emptyTitle="No applicants yet." rowNav={{ key: "applicants", id: (r) => String(r.id) }}
      mobile={(r) => (
        <span className="flex items-center gap-3">
          <Initials name={r.name} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2"><span className="truncate font-medium">{r.name}</span><StatusPill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusPill></span>
            <span className="block truncate text-[13px] text-muted-foreground">{r.programme} · {r.batch} · {CATEGORY_LABEL[r.category as ApplicantCategory] ?? r.category}</span>
          </span>
          <span className={r.complete ? "text-sm tabular-nums text-ok" : "text-sm tabular-nums"}>{progress(r)}</span>
        </span>
      )}
      onRowClick={(r) => router.push(`/applicants?applicant=${r.id}`, { scroll: false })} />
  );
}
