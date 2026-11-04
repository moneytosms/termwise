import Link from "next/link";
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
    return (
      <>
        <PageHeader title="Marks" description="Your subjects." />
        {rows.length === 0 ? <EmptyState title="No subjects are assigned to you yet." /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <Link key={r.id} href={`/marks/${r.id}`} className="rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-sm text-muted-foreground">{r.code}</span>
                  <StatusPill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusPill>
                </div>
                <p className="mt-2 font-medium">{r.name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Batch {r.batch}</p>
                <p className="mt-3 text-sm"><span className="font-mono">{r.filled}/{r.needed}</span> <span className="text-muted-foreground">marks entered</span></p>
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
