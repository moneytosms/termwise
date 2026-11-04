"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type TableFilter } from "@/components/data-table";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SectionHeading } from "@/components/page";
import { EmptyState } from "@/components/states";
import type { PastRow, SessionDetail } from "./queries";

const unique = (xs: string[]) => [...new Set(xs)].sort();
const mono = (n: number) => <span className="font-mono">{n}</span>;

const columns: ColumnDef<PastRow>[] = [
  { accessorKey: "date", header: "Date", cell: ({ row }) => <span className="font-mono">{row.original.date}</span> },
  { accessorKey: "period", header: "Period", cell: ({ row }) => mono(row.original.period) },
  { accessorKey: "batch", header: "Batch" },
  { accessorKey: "subject", header: "Subject" },
  { accessorKey: "present", header: "Present", cell: ({ row }) => mono(row.original.present) },
  { accessorKey: "absent", header: "Absent", cell: ({ row }) => <span className="font-mono text-absent">{row.original.absent}</span> },
  { accessorKey: "late", header: "Late", cell: ({ row }) => mono(row.original.late) },
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
                <SheetDescription><span className="font-mono">{detail.date}</span> · Period {detail.period}</SheetDescription>
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
        <ul className="divide-y rounded-xl border">
          {list.map((s) => (
            <li key={s.rollNo} className="flex justify-between gap-3 px-3 py-2 text-sm">
              <span className="font-mono">{s.rollNo}</span><span>{s.name}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
