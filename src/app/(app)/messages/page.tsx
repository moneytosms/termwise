import { EmptyState } from "@/components/states";
import { Panel, PageHeader, StatCard, StatStrip } from "@/components/page";
import { istDate } from "@/domain/attendance";
import { previews } from "@/domain/templates";
import { requireCan } from "@/server/access";
import { KIND, LANGUAGE, STATUS } from "./labels";
import { listMessages } from "./queries";
import { MessagePanel } from "./message-panel";
import { MessagesTable } from "./messages-table";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const v = await requireCan("messages");
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
      <Panel title="Templates" className="mt-6">
        <p className="mb-4 text-sm text-muted-foreground">Odia text needs native-speaker review.</p>
        <div className="grid gap-4 md:grid-cols-2">
          {previews().map((p) => (
            <div key={p.kind} className="flex flex-col gap-3">
              <h3 className="text-sm font-medium">{KIND[p.kind]}</h3>
              <div>
                <p className="text-xs text-muted-foreground">{LANGUAGE.en}</p>
                <p className="text-sm">{p.en}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{LANGUAGE.or}</p>
                <p className="text-sm">{p.or}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      {open && <MessagePanel message={open} />}
    </>
  );
}
