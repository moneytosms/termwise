import { SectionHeading, StatusPill, type Tone } from "@/components/page";
import { EmptyState } from "@/components/states";
import { APPEAL_LABEL, type AppealStatus } from "@/domain/appeals";

const TONE: Record<AppealStatus, Tone> = { open: "late", accepted: "ok", rejected: "absent" };

export function AppealPill({ status }: { status: AppealStatus }) {
  return <StatusPill tone={TONE[status]}>{APPEAL_LABEL[status]}</StatusPill>;
}

/** The student's own appeals of one kind. `title` says what each one is about. */
export function AppealList({ items }: {
  items: { id: number; title: string; reason: string; status: AppealStatus; response: string | null }[];
}) {
  return (
    <>
      <SectionHeading title="Your appeals" count={items.length} />
      {items.length === 0 ? <EmptyState title="No appeals yet." /> : (
        <ul className="divide-y divide-rule rounded-xl bg-card px-4 text-sm shadow-sheet">
          {items.map((a) => (
            <li key={a.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 font-medium">{a.title}</span>
                <AppealPill status={a.status} />
              </div>
              <p className="mt-1 text-pretty">{a.reason}</p>
              {a.response && <p className="mt-1 text-muted-foreground">Office: {a.response}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
