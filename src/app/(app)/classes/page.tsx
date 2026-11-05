import { redirect } from "next/navigation";
import { PageHeader, SectionHeading } from "@/components/page";
import { EmptyState } from "@/components/states";
import { istDayOfWeek } from "@/domain/attendance";
import { cn } from "@/lib/utils";
import { requireViewer } from "@/server/access";
import { getPastSessions, getSessionDetail, getWeek } from "./queries";
import { OnlineOnly } from "./online-only";
import { PastSessions } from "./past-sessions";
import { Today } from "./today";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const v = await requireViewer();
  if (v.role === "office_admin") redirect("/attendance");
  const { session } = await searchParams;
  const [week, past, detail] = await Promise.all([
    getWeek(v),
    getPastSessions(v),
    session && /^[0-9a-f-]{36}$/i.test(session) ? getSessionDetail(v, session) : null,
  ]);
  const today = istDayOfWeek();

  return (
    <>
      <PageHeader title="Classes" />
      <Today />
      <OnlineOnly>
        <section>
          <SectionHeading title="This week" />
          {week.length === 0 ? <EmptyState title="No timetable classes for you." /> : (
            <ol className="divide-y rounded-xl bg-card shadow-sheet">
              {MON_FIRST.map((d) => {
                const slots = week.filter((s) => s.day === d);
                return slots.length === 0 ? null : (
                  <li key={d} className={cn("px-4 py-3", d === today && "bg-data-soft/60")}>
                    <p className="text-sm font-medium">{DAYS[d]}{d === today && <span className="ml-2 text-xs font-medium text-data">Today</span>}</p>
                    <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                      {slots.map((s, i) => <li key={i}><span className="tabular-nums">{s.startTime}</span> {s.subject} · {s.batch}</li>)}
                    </ul>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section>
          <SectionHeading title="Past sessions" count={past.length} />
          <PastSessions rows={past} open={Boolean(session)} detail={detail} />
        </section>
      </OnlineOnly>
    </>
  );
}
