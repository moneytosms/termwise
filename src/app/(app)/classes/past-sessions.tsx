"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { RegisterBar } from "@/components/charts";
import { DataTable, type TableFilter } from "@/components/data-table";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SectionHeading } from "@/components/page";
import { EmptyState } from "@/components/states";
import type { PastRow, SessionDetail } from "./queries";

const unique = (xs: string[]) => [...new Set(xs)].sort();

const columns: ColumnDef<PastRow>[] = [
  { accessorKey: "subject", header: "Subject", cell: ({ row: { original: r } }) => <span><span className="block font-medium">{r.subject}</span><span className="block text-xs text-muted-foreground">{r.batch} · Period {r.period}</span></span> },
  { accessorKey: "date", header: "Date", cell: ({ row }) => <span className="text-muted-foreground">{row.original.date}</span> },
  { accessorKey: "batch", header: "Batch", meta: { hidden: true } },
  { accessorKey: "period", header: "Period", meta: { hidden: true } },
  { id: "register", header: "Register", enableSorting: false, cell: ({ row: { original: r } }) => <RegisterBar present={r.present} late={r.late} absent={r.absent} /> },
  { accessorKey: "present", header: "Present", meta: { align: "right" } },
  { accessorKey: "absent", header: "Absent", meta: { align: "right" }, cell: ({ row }) => <span className={row.original.absent ? "font-medium text-absent" : "text-muted-foreground"}>{row.original.absent}</span> },
  { accessorKey: "late", header: "Late", meta: { align: "right" } },
];

export function PastSessions({ rows, open, detail }: { rows: PastRow[]; open: boolean; detail: SessionDetail | null }) {
  const router = useRouter();
  const filters: TableFilter<PastRow>[] = [
    { label: "Subject", options: unique(rows.map((r) => r.subject)), get: (r) => r.subject },
    { label: "Batch", options: unique(rows.map((r) => r.batch)), get: (r) => r.batch },
  ];

  return (
    <>
      <DataTable data={rows} columns={columns} filters={filters} emptyTitle="No attendance sessions yet."
        mobile={(r) => (
          <span className="block">
            <span className="flex items-center justify-between gap-3"><span className="truncate font-medium">{r.subject}</span><span className="text-sm tabular-nums">{r.present}<span className="text-muted-foreground">/{r.present + r.absent + r.late}</span></span></span>
            <span className="mt-0.5 flex items-center justify-between gap-3 text-[13px] text-muted-foreground"><span className="truncate">{r.date} · {r.batch} · P{r.period}</span>{r.absent > 0 && <span className="shrink-0 text-absent">{r.absent} absent</span>}</span>
          </span>
        )}
        onRowClick={(r) => router.push(`/classes?session=${r.id}`, { scroll: false })} />
      <Sheet open={open} onOpenChange={(o) => { if (!o) router.push("/classes", { scroll: false }); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {!detail ? (
            <>
              <SheetHeader><SheetTitle>Session</SheetTitle><SheetDescription className="sr-only">Not available</SheetDescription></SheetHeader>
              <div className="px-4"><EmptyState title="This session isn't available to you." /></div>
            </>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>{detail.subject} · {detail.batch}</SheetTitle>
                <SheetDescription><span className="tabular-nums">{detail.date}</span> · Period {detail.period}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-8">
                {detail.isToday ? (
                  <Link href={`/mark#${encodeURIComponent(detail.key)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Edit</Link>
                ) : (
                  <p className="text-sm text-muted-foreground">After the day ends, an office admin corrects attendance with a reason.</p>
                )}
                <StudentList title="Absent" list={detail.absent} />
                <StudentList title="Late" list={detail.late} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
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
