import { PageHeader } from "@/components/page";
import { EmptyState } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { istDate } from "@/domain/attendance";
import { REPORT_CAP, REPORTS, type ReportKey, type Row } from "@/domain/reports";
import { redirect } from "next/navigation";
import { can } from "@/domain/roles";
import { requireViewer } from "@/server/access";
import { cn } from "@/lib/utils";
import { listProgrammes, runReport } from "./queries";

const PREVIEW_ROWS = 200;

export default async function ReportsPage({ searchParams }: {
  searchParams: Promise<{ report?: string; month?: string; programme?: string }>;
}) {
  const v = await requireViewer();
  const allowed = REPORTS.filter((r) => can(v.role, REPORT_CAP[r.key]));
  if (!allowed.length) redirect("/home");
  const sp = await searchParams;
  const report: ReportKey = allowed.find((r) => r.key === sp.report)?.key ?? allowed[0].key;
  const month = sp.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : istDate().slice(0, 7);
  const programmeId = sp.programme && /^\d+$/.test(sp.programme) ? Number(sp.programme) : null;

  const [programmes, { columns, rows }] = await Promise.all([
    listProgrammes(v.campusId),
    runReport(v, report, { month, programmeId }),
  ]);
  const shown = rows.slice(0, PREVIEW_ROWS);
  const meta = REPORTS.find((r) => r.key === report)!;
  const query = new URLSearchParams({ month, ...(programmeId !== null && { programme: String(programmeId) }) });

  return (
    <>
      <PageHeader title="Reports" description="University, AICTE and NAAC returns. Export as CSV." actions={
        <a href={`/reports/${report}/export?${query}`} className={buttonVariants({ variant: "outline" })}>Export CSV</a>
      } />
      <form aria-label="Report picker" className="mb-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Report
          <select name="report" defaultValue={report} className="h-8 rounded-md border border-border bg-card px-2 text-sm">
            {allowed.map((r) => <option key={r.key} value={r.key}>{r.title}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Month
          <Input type="month" name="month" defaultValue={month} className="w-auto" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Programme
          <select name="programme" defaultValue={programmeId ?? ""} className="h-8 rounded-md border border-border bg-card px-2 text-sm">
            <option value="">All programmes</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select>
        </label>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>Show</button>
      </form>
      <p className="mb-3 text-sm text-muted-foreground">
        {meta.title}: {rows.length} {rows.length === 1 ? "row" : "rows"}
        {rows.length > PREVIEW_ROWS && ` (first ${PREVIEW_ROWS} shown; the CSV has all of them)`}.
      </p>
      {rows.length === 0 ? (
        <EmptyState title="Nothing to report for this month." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => <TableHead key={c.key} className="whitespace-nowrap">{c.label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r: Row, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={cn("whitespace-nowrap", typeof r[c.key] === "number" && "tabular-nums")}>
                      {r[c.key] ?? "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
