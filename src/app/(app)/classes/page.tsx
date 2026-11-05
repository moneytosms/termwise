import { redirect } from "next/navigation";
import { PageHeader, SectionHeading, StatusPill } from "@/components/page";
import { EmptyState } from "@/components/states";
import { istDate, istDayOfWeek, istTime } from "@/domain/attendance";
import { shiftDays } from "@/domain/staff-leave";
import { cn } from "@/lib/utils";
import { requireViewer } from "@/server/access";
import { approvedLeaveDays, getPastSessions, getSessionDetail, getWeek, type WeekSlot } from "./queries";
import { OnlineOnly } from "./online-only";
import { PastSessions } from "./past-sessions";
import { Today } from "./today";
import { can } from "@/domain/roles";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
const SHORT = DAYS.map((d) => d.slice(0, 3));

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const v = await requireViewer();
  if (!can(v.role, "teach")) redirect("/attendance");
  const { session } = await searchParams;
  const weekStart = shiftDays(istDate(), -((istDayOfWeek() + 6) % 7));
  const [week, past, detail, leaveDays] = await Promise.all([
    getWeek(v),
    getPastSessions(v),
    session && /^[0-9a-f-]{36}$/i.test(session) ? getSessionDetail(v, session) : null,
    approvedLeaveDays(v, weekStart),
  ]);
  const today = istDayOfWeek();
  const now = istTime();
  const days = MON_FIRST.filter((d) => week.some((s) => s.day === d));
  const times = [...new Set(week.map((s) => s.startTime))].sort();
  const isNow = (s: WeekSlot) => s.startTime <= now && now < s.endTime;

  return (
    <>
      <PageHeader title="Classes" />
      <Today />
      <OnlineOnly>
        <section>
          <SectionHeading title="This week" />
          {week.length === 0 ? <EmptyState title="No timetable classes for you." /> : (
            <div className="overflow-x-auto rounded-xl bg-card shadow-sheet">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-3 py-2.5 font-medium">Time</th>
                    {days.map((d) => (
                      <th key={d} scope="col" className={cn("px-3 py-2.5 font-medium", d === today && "bg-data-soft/40 text-data")}>
                        <span className="block">{d === today ? "Today" : SHORT[d]}</span>
                        {leaveDays.has(shiftDays(weekStart, (d + 6) % 7)) && <StatusPill>On leave</StatusPill>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {times.map((t, r) => (
                    <tr key={t} className={cn(r % 2 === 1 && "bg-muted/30")}>
                      <th scope="row" className="px-3 py-2 text-left font-normal whitespace-nowrap text-muted-foreground tabular-nums">{t}</th>
                      {days.map((d) => {
                        const slots = week.filter((s) => s.day === d && s.startTime === t);
                        const onLeave = leaveDays.has(shiftDays(weekStart, (d + 6) % 7));
                        return (
                          <td key={d} className={cn("p-1.5 align-top", d === today && "bg-data-soft/40", onLeave && "opacity-50")}>
                            {slots.length === 0 ? <span aria-hidden className="mx-auto mt-3 block size-1 rounded-full bg-border" /> : slots.map((s, i) => (
                              <div key={i} title={`${s.startTime}–${s.endTime} · ${s.subject} · ${s.batch}`}
                                className={cn("rounded-lg px-2.5 py-2 transition-colors hover:bg-muted", d === today && isNow(s) && "ring-2 ring-data")}>
                                <span className="block font-medium">{s.subject}</span>
                                <span className="block text-xs text-muted-foreground">{s.batch}</span>
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
