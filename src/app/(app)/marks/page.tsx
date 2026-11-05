import Link from "next/link";
import { Progress } from "@/components/charts";
import { PageHeader, StatusPill } from "@/components/page";
import { EmptyState } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { requireViewer } from "@/server/access";
import type { MarksStatus } from "@/domain/marks";
import { listSubjects } from "./queries";
import { STATUS } from "./shared";
import { SubjectsTable } from "./subjects-table";

export default async function MarksPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const v = await requireViewer();
  const { status } = await searchParams;
  const rows = await listSubjects(v);

  if (v.role === "faculty") {
    const mine = status && status in STATUS ? rows.filter((r) => r.status === status) : rows;
    return (
      <>
        <PageHeader title="Marks" description={`${rows.length} subjects · ${rows.filter((r) => r.status === "draft").length} still in draft`} />
        <div role="group" aria-label="Filter by status" className="mb-4 flex flex-wrap gap-1.5">
          {[["", "All"], ...Object.entries(STATUS).map(([value, s]) => [value, s.label])].map(([value, label]) => {
            const active = (status ?? "") === value;
            return (
              <Link key={value} href={value ? `/marks?status=${value}` : "/marks"} aria-current={active ? "page" : undefined}
                className={`inline-flex h-8 items-center rounded-full px-3 text-sm transition-colors ${active ? "bg-foreground font-medium text-background" : "bg-card text-muted-foreground shadow-sheet hover:text-foreground"}`}>
                {label}
              </Link>
            );
          })}
        </div>
        {rows.length === 0 ? <EmptyState title="No subjects are assigned to you yet." /> : mine.length === 0 ? <EmptyState title="No subjects in this status." /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((r) => (
              <Link key={r.id} href={`/marks/${r.id}`} className="group flex flex-col rounded-xl bg-card p-4 shadow-sheet transition-[background-color,box-shadow] duration-150 hover:bg-muted/40 hover:shadow-float active:bg-muted md:p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0"><span className="block font-medium">{r.name}</span><span className="block text-sm text-muted-foreground">{r.code} · {r.batch}</span></span>
                  <StatusPill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusPill>
                </div>
                <span className="mt-5 flex items-center justify-between gap-3 text-sm text-muted-foreground">Marks entered<Progress filled={r.filled} needed={r.needed} /></span>
              </Link>
            ))}
          </div>
        )}
      </>
    );
  }

  const preset: Record<string, string> = status && status in STATUS ? { Status: STATUS[status as MarksStatus].label } : {};
  return (
    <>
      <PageHeader title="Marks" description={`${rows.length} subjects on this campus.`} />
      <SubjectsTable rows={rows} initialFilters={preset} emptyAction={<Link href="/setup" className={buttonVariants({ variant: "outline", size: "sm" })}>Go to College setup</Link>} />
    </>
  );
}
