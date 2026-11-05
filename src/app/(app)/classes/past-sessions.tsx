"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { RegisterBar } from "@/components/charts";
import { DataTable, type TableFilter } from "@/components/data-table";
import { RecordModal } from "@/components/record-modal";
import { buttonVariants } from "@/components/ui/button";
import { SectionHeading } from "@/components/page";
import { EmptyState } from "@/components/states";
import { attendancePercent, isShortage } from "@/domain/attendance";
import { cn } from "@/lib/utils";
import type { PastRow, SessionDetail } from "./queries";

const unique = (xs: string[]) => [...new Set(xs)].sort();

/** Late counts as present, as on the attendance pages. Null when nothing was recorded. */
const percentOf = (c: { present: number; late: number; absent: number }) => attendancePercent([
  { status: "present", periods: c.present }, { status: "late", periods: c.late }, { status: "absent", periods: c.absent },
]);
const pctLabel = (p: number | null) => (p === null ? "—" : `${p.toFixed(1)}%`);
const LOW_PCT = 75;

const columns: ColumnDef<PastRow>[] = [
  { accessorKey: "subject", header: "Subject", cell: ({ row: { original: r } }) => <span><span className="block font-medium">{r.subject}</span><span className="block text-xs text-muted-foreground">{r.batch} · Period {r.period}</span></span> },
  { accessorKey: "date", header: "Date", cell: ({ row }) => <span className="text-muted-foreground">{row.original.date}</span> },
  { accessorKey: "batch", header: "Batch", meta: { hidden: true } },
  { accessorKey: "period", header: "Period", meta: { hidden: true } },
  { id: "register", header: "Register", enableSorting: false, cell: ({ row: { original: r } }) => <RegisterBar present={r.present} late={r.late} absent={r.absent} /> },
  { accessorKey: "present", header: "Present", meta: { align: "right" } },
  { accessorKey: "absent", header: "Absent", meta: { align: "right" }, cell: ({ row }) => <span className={row.original.absent ? "font-medium text-absent" : "text-muted-foreground"}>{row.original.absent}</span> },
  { accessorKey: "late", header: "Late", meta: { align: "right" } },
  { id: "percent", header: "Present %", meta: { align: "right" }, accessorFn: (r) => percentOf(r) ?? -1,
    cell: ({ row: { original: r } }) => { const p = percentOf(r); return <span className={cn("tabular-nums", isShortage(p, LOW_PCT) && "font-medium text-absent")}>{pctLabel(p)}</span>; } },
];

export function PastSessions({ rows, open, detail }: { rows: PastRow[]; open: boolean; detail: SessionDetail | null }) {
  const router = useRouter();
  const filters: TableFilter<PastRow>[] = [
    { label: "Subject", options: unique(rows.map((r) => r.subject)), get: (r) => r.subject },
    { label: "Batch", options: unique(rows.map((r) => r.batch)), get: (r) => r.batch },
  ];
  const pct = detail ? percentOf(detail.counts) : null;

  return (
    <>
      <DataTable data={rows} columns={columns} filters={filters} emptyTitle="No attendance sessions yet."
        rowNav={{ key: "past-sessions", id: (r) => r.id }}
        mobile={(r) => {
          const p = percentOf(r);
          return (
            <span className="block">
              <span className="flex items-center justify-between gap-3"><span className="truncate font-medium">{r.subject}</span><span className={cn("text-sm tabular-nums", isShortage(p, LOW_PCT) && "font-medium text-absent")}>{pctLabel(p)}</span></span>
              <span className="mt-0.5 flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
                <span className="truncate">{r.date} · {r.batch} · P{r.period}</span>
                <span className="shrink-0 tabular-nums">{r.present}<span>/{r.present + r.absent + r.late}</span>{r.absent > 0 && <span className="text-absent"> · {r.absent} absent</span>}</span>
              </span>
            </span>
          );
        }}
        onRowClick={(r) => router.push(`/classes?session=${r.id}`, { scroll: false })} />
      {open && (
        <RecordModal
          title={detail ? `${detail.subject} · ${detail.batch}` : "Session"}
          description={detail ? <><span className="tabular-nums">{detail.date}</span> · Period {detail.period}</> : "Not available"}
          nav={detail ? { key: "past-sessions", id: detail.id, href: (id) => `/classes?session=${id}` } : undefined}
          onClose={() => router.push("/classes", { scroll: false })}>
          {!detail ? <EmptyState title="This session isn't available to you." /> : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
                <p className={cn("text-4xl leading-none font-semibold tracking-tight tabular-nums", isShortage(pct, LOW_PCT) && "text-absent")}>{pctLabel(pct)}</p>
                <p className="text-sm text-muted-foreground tabular-nums">Present {detail.counts.present} · Late {detail.counts.late} · Absent {detail.counts.absent}</p>
              </div>
              {detail.isToday ? (
                <Link href={`/mark#${encodeURIComponent(detail.key)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Edit</Link>
              ) : (
                <p className="text-sm text-muted-foreground">After the day ends, an office admin corrects attendance with a reason.</p>
              )}
              <StudentList title="Absent" list={detail.absent} />
              <StudentList title="Late" list={detail.late} />
            </div>
          )}
        </RecordModal>
      )}
    </>
  );
}

function StudentList({ title, list }: { title: string; list: { rollNo: string; name: string }[] }) {
  return (
    <section>
      <SectionHeading title={title} count={list.length} />
      {list.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
        <ul className="divide-y rounded-lg bg-muted/60">
          {list.map((s) => (
            <li key={s.rollNo} className="flex justify-between gap-3 px-3 py-2 text-sm">
              <span className="tabular-nums">{s.rollNo}</span><span>{s.name}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
