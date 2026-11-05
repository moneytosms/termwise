import { EmptyState } from "@/components/states";
import { PageHeader, StatCard, StatStrip } from "@/components/page";
import { istDate } from "@/domain/attendance";
import { requireAdmin } from "@/server/access";
import { KIND, STATUS } from "./labels";
import { listMessages } from "./queries";
import { MessagePanel } from "./message-panel";
import { MessagesTable } from "./messages-table";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const v = await requireAdmin();
  const { message } = await searchParams;
  const rows = await listMessages(v);
  const open = message && /^\d+$/.test(message) ? rows.find((r) => r.id === Number(message)) : undefined;
  const today = rows.filter((r) => r.day === istDate());
  const count = (f: (r: (typeof rows)[number]) => boolean) => today.filter(f).length;
  return (
    <>
      <PageHeader title="Messages" description="Mock message log. Nothing is really sent." />
      <StatStrip cols={4}>
        <StatCard label="Logged today" value={count((r) => r.status === STATUS.logged)} tone="ok" />
        <StatCard label="Blocked for no parental consent" value={count((r) => r.status === STATUS.blocked_no_consent)} tone="absent" />
        <StatCard label="Shortage alerts" value={count((r) => r.kind === KIND.shortage)} tone="late" />
        <StatCard label="Fee reminders" value={count((r) => r.kind === KIND.fee_reminder)} />
      </StatStrip>
      <div className="mt-6">
        {rows.length === 0
          ? <EmptyState title="No messages yet. They appear after the daily check runs." />
          : <MessagesTable rows={rows} />}
      </div>
      {open && <MessagePanel message={open} />}
    </>
  );
}
