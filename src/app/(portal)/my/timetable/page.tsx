import type { CSSProperties } from "react";
import { PageHeader, Panel, SectionHeading, StatusPill, type Tone } from "@/components/page";
import { EmptyState } from "@/components/states";
import { currentOrNext, istDate, istDayOfWeek, istTime, type AttendanceStatus } from "@/domain/attendance";
import { cn } from "@/lib/utils";
import { requirePortal } from "@/server/portal";
import { portalStudent } from "@/server/portal-data";
import { TodayCarousel } from "../today-carousel";
import { AcademicCalendar } from "./academic-calendar";
import { getCalendar, getSlots, getTodayMarks, type Slot } from "./queries";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
const MARK: Record<AttendanceStatus, { tone: Tone; label: string }> = {
  present: { tone: "ok", label: "Present" },
  late: { tone: "late", label: "Late" },
  absent: { tone: "absent", label: "Absent" },
};

const subjectName = (x: Slot) => x.name ?? x.label ?? "Other";

export default async function TimetablePage() {
  const v = await requirePortal();
  const s = await portalStudent(v.studentId);
  const today = istDate();
  const dow = istDayOfWeek();
  const now = istTime();
  const [slots, marks, calendar] = await Promise.all([
    getSlots(s.batchId), getTodayMarks(s.batchId, v.studentId, today), getCalendar(v.campusId),
  ]);
  const holiday = calendar.find((d) => d.date === today && d.kind === "holiday");
  const todays = slots.filter((x) => x.day === dow);
  const cur = currentOrNext(todays, now);
  const start = cur ? todays.indexOf(cur.cls) : todays.length - 1;
  const todayIdx = MON_FIRST.indexOf(dow);

  return (
    <>
      <PageHeader title="Timetable" description={`${s.programme} · Semester ${s.semester}`} />

      <Panel title={`Today, ${DAYS[dow]}`}>
        {holiday ? (
          <p className="flex items-center gap-2 text-sm"><StatusPill tone="ok">Holiday</StatusPill>{holiday.label}</p>
        ) : todays.length === 0 ? (
          <p className="text-sm text-muted-foreground">No classes today.</p>
        ) : (
          <TodayCarousel start={start}>
            {todays.map((x) => {
              const isCur = cur?.cls.id === x.id;
              return (
                <div key={x.id} className="flex items-center gap-3 rounded-lg bg-muted/50 px-2.5 py-2.5">
                  <span className="w-24 shrink-0 text-sm text-muted-foreground tabular-nums">{x.startTime}–{x.endTime}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{subjectName(x)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[x.teacher, x.periodCount > 1 && `${x.periodCount} periods`].filter(Boolean).join(" · ") || " "}
                    </span>
                  </span>
                  <MarkPill slot={x} now={now} marks={marks} />
                  {isCur && <StatusPill tone="ok">{cur.running ? "Now" : `Next at ${x.startTime}`}</StatusPill>}
                </div>
              );
            })}
          </TodayCarousel>
        )}
      </Panel>

      <SectionHeading title="This week" />
      {slots.length === 0 ? <EmptyState title="No timetable set for your batch yet." /> : (
        <div className="flex flex-col gap-3 md:grid md:grid-cols-7 md:items-start">
          {MON_FIRST.map((d, i) => {
            const day = slots.filter((x) => x.day === d);
            const isToday = d === dow;
            return (
              <section
                key={d}
                aria-label={DAYS[d]}
                // Phone: today first, then the days after it. md+: Monday to Sunday.
                style={{ "--day-order": (i - todayIdx + 7) % 7 } as CSSProperties}
                className={cn("order-(--day-order) flex min-w-0 flex-col gap-2 rounded-xl bg-card p-3 shadow-sheet md:order-none", isToday && "ring-2 ring-data")}
              >
                <h3 className="flex items-center justify-between px-1 text-sm font-medium">
                  {DAYS[d]}
                  {isToday && <span className="text-xs text-data">Today</span>}
                </h3>
                {day.length === 0 ? <p className="px-1 text-xs text-muted-foreground">No classes</p> : day.map((x) => (
                  <div key={x.id} className="rounded-lg bg-muted/50 px-2.5 py-2">
                    <p className="text-xs text-muted-foreground tabular-nums">{x.startTime}–{x.endTime}</p>
                    <p className="truncate text-sm font-medium" title={subjectName(x)}>{x.code ?? subjectName(x)}</p>
                    {x.periodCount > 1 && <p className="text-xs text-muted-foreground">{x.periodCount} periods</p>}
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}

      <SectionHeading title="Academic calendar" />
      <AcademicCalendar entries={calendar} today={today} />
    </>
  );
}

/** Today's mark for a class that has started. Club and sports slots have no attendance. */
function MarkPill({ slot, now, marks }: { slot: Slot; now: string; marks: Map<string, AttendanceStatus | null> }) {
  if (slot.subjectId === null || slot.startTime > now) return null;
  const status = marks.get(`${slot.subjectId}:${slot.period}`);
  return status
    ? <StatusPill tone={MARK[status].tone}>{MARK[status].label}</StatusPill>
    : <span className="text-xs whitespace-nowrap text-muted-foreground">Not marked yet</span>;
}
