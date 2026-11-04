import { AlertTriangle, IndianRupee, Users, Wallet } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page";
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
      <PageHeader title="Fees" description={`${rows.length} students on this campus.`} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total due" value={rupees(totalDue)} icon={IndianRupee} />
        <StatCard label="Overdue" value={rupees(overdue)} icon={AlertTriangle} tone="absent" href="/fees?status=Overdue" />
        <StatCard label="Students with dues" value={withDues} icon={Users} tone="late" />
        <StatCard label="Collected this month" value={rupees(collected)} icon={Wallet} tone="ok" />
      </div>
      <div className="mt-6">
        <FeesTable rows={rows} initialFilters={status && STATUSES.includes(status) ? { Status: status } : {}} />
      </div>
      {student && <FeePanel detail={detail} />}
    </>
  );
}
