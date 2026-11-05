import { PageHeader, StatCard, StatStrip } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { istDate } from "@/domain/attendance";
import { requireAdmin } from "@/server/access";
import { rupees } from "@/lib/utils";
import { FeePanel } from "./fee-panel";
import { FeesTable } from "./fees-table";
import { collectedThisMonth, getFeeDetail, listFeeDues } from "./queries";

const STATUSES = ["Clear", "Due", "Overdue"];

export default async function FeesPage({ searchParams }: { searchParams: Promise<{ student?: string; status?: string }> }) {
  const v = await requireAdmin();
  const { student, status } = await searchParams;
  const rows = await listFeeDues(v);
  const collected = await collectedThisMonth(v);
  const detail = student && /^\d+$/.test(student) ? await getFeeDetail(v, Number(student)).catch(() => null) : null;
  const totalDue = rows.reduce((n, r) => n + r.duePaise, 0);
  const overdue = rows.reduce((n, r) => n + r.overduePaise, 0);
  const withDues = rows.filter((r) => r.duePaise > 0).length;
  return (
    <>
      <PageHeader title="Fees" description={`${rows.length} students on this campus.`} actions={
        <form action="/fees/tally" className="flex flex-wrap items-end gap-2">
          <Input type="date" name="from" aria-label="Tally export from" defaultValue={`${istDate().slice(0, 7)}-01`} className="w-auto" />
          <Input type="date" name="to" aria-label="Tally export to" defaultValue={istDate()} className="w-auto" />
          <Button type="submit" variant="outline">Download Tally XML</Button>
        </form>
      } />
      <StatStrip cols={4}>
        <StatCard label="Total due" value={rupees(totalDue)} />
        <StatCard label="Overdue" value={rupees(overdue)} tone="absent" href="/fees?status=Overdue" />
        <StatCard label="Students with dues" value={withDues} tone="late" />
        <StatCard label="Collected this month" value={rupees(collected)} tone="ok" />
      </StatStrip>
      <div className="mt-6">
        <FeesTable rows={rows} initialFilters={status && STATUSES.includes(status) ? { Status: status } : {}} />
      </div>
      {student && <FeePanel detail={detail} />}
    </>
  );
}
