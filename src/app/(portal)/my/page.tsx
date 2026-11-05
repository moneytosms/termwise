import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { CalendarCheck, CalendarClock, UserRoundCheck, Wallet } from "lucide-react";
import { paidSql } from "@/app/(app)/fees/queries";
import { ModuleCard, PageHeader, SectionHeading, StatCard, StatStrip, StatusPill, type Tone } from "@/components/page";
import { EmptyState } from "@/components/states";
import { attendancePercent, classesToReach, currentOrNext, istDate, istDayOfWeek, istTime, isShortage, type AttendanceStatus } from "@/domain/attendance";
import { dues, instalmentDue } from "@/domain/fees";
import { isMinor } from "@/domain/templates";
import { rupees } from "@/lib/utils";
import { db } from "@/server/db";
import { requirePortal } from "@/server/portal";
import { portalStudent } from "@/server/portal-data";
import { TodayCarousel } from "./today-carousel";
import { attendanceEntry, attendanceSession, feeInstalment, leaveRequest, mark, markComponent, subject, timetableSlot } from "@/server/schema";

const STATUS: Record<AttendanceStatus, { tone: Tone; label: string }> = {
  present: { tone: "ok", label: "Present" },
  late: { tone: "late", label: "Late" },
  absent: { tone: "absent", label: "Absent" },
};
const round = (n: number) => Math.round(n * 100) / 100;

export default async function PortalHome() {
  const v = await requirePortal();
  const s = await portalStudent(v.studentId);
  if (!s) notFound();
  const me = v.role === "student";
  const who = me ? "Your" : `${s.name.split(" ")[0]}'s`;
  const today = istDate();

  const att = await db.select({ subject: subject.name, status: attendanceEntry.status, periods: attendanceSession.periodCount })
    .from(attendanceEntry)
    .innerJoin(attendanceSession, eq(attendanceEntry.sessionId, attendanceSession.id))
    .innerJoin(subject, eq(attendanceSession.subjectId, subject.id))
    .where(eq(attendanceEntry.studentId, v.studentId));
  const bySubject = new Map<string, typeof att>();
  for (const a of att) bySubject.set(a.subject, [...(bySubject.get(a.subject) ?? []), a]);
  const subjects = [...bySubject].flatMap(([name, rows]) => {
    const percent = attendancePercent(rows);
    if (percent === null) return [];
    const held = rows.reduce((n, r) => n + r.periods, 0);
    const attended = rows.reduce((n, r) => n + (r.status === "absent" ? 0 : r.periods), 0);
    return [{ name, percent, toReach: classesToReach(attended, held, s.cutoff) }];
  });
  const overall = attendancePercent(att);
  const short = subjects.filter((x) => isShortage(x.percent, s.cutoff));

  const markRows = await db.select({ marks: mark.marks, max: markComponent.maxMarks }).from(mark)
    .innerJoin(markComponent, eq(mark.componentId, markComponent.id))
    .where(eq(mark.studentId, v.studentId));
  const entered = markRows.filter((r) => r.marks !== null);
  const obtained = round(entered.reduce((n, r) => n + (r.marks ?? 0), 0));
  const possible = entered.reduce((n, r) => n + r.max, 0);

  const instalments = await db.select({
    id: feeInstalment.id, dueDate: feeInstalment.dueDate, amountPaise: feeInstalment.amountPaise,
    scholarshipPaise: feeInstalment.scholarshipPaise, paidPaise: paidSql,
  }).from(feeInstalment).where(eq(feeInstalment.studentId, v.studentId));
  const { totalPaise, overduePaise } = dues(instalments, today);
  const overdueCount = instalments.filter((i) => instalmentDue(i) > 0 && i.dueDate < today).length;

  const leaves = await db.select({ status: leaveRequest.status }).from(leaveRequest)
    .where(and(eq(leaveRequest.studentId, v.studentId), inArray(leaveRequest.status, ["pending_parent", "pending_mentor"])));
  const awaitingParent = leaves.filter((l) => l.status === "pending_parent").length;
  const pending = me ? leaves.length : awaitingParent;

  const slots = me ? await db.select({
    startTime: timetableSlot.startTime, endTime: timetableSlot.endTime, period: timetableSlot.period,
    subjectId: timetableSlot.subjectId, subject: subject.name, label: timetableSlot.label,
  }).from(timetableSlot)
    .leftJoin(subject, eq(timetableSlot.subjectId, subject.id))
    .where(and(eq(timetableSlot.batchId, s.batchId), eq(timetableSlot.dayOfWeek, istDayOfWeek())))
    .orderBy(timetableSlot.startTime) : [];
  const sessions = me ? await db.select({ subjectId: attendanceSession.subjectId, period: attendanceSession.period, status: attendanceEntry.status })
    .from(attendanceSession)
    .leftJoin(attendanceEntry, and(eq(attendanceEntry.sessionId, attendanceSession.id), eq(attendanceEntry.studentId, v.studentId)))
    .where(and(eq(attendanceSession.batchId, s.batchId), eq(attendanceSession.date, today))) : [];
  const now = istTime();
  const todayRows = slots.map((c) => ({ ...c, session: sessions.find((x) => x.subjectId === c.subjectId && x.period === c.period) }));
  const cur = currentOrNext(todayRows, now);
  const start = cur ? todayRows.indexOf(cur.cls) : todayRows.length - 1;

  const attention = [
    ...short.map((x) => ({ key: `short-${x.name}`, href: "/my/attendance", icon: CalendarCheck, title: x.name, description: `${x.percent}% · attend next ${x.toReach} in a row to reach ${s.cutoff}%` })),
    ...(overdueCount > 0 ? [{ key: "fees", href: "/my/fees", icon: Wallet, title: `${overdueCount} overdue ${overdueCount === 1 ? "instalment" : "instalments"}`, description: `${rupees(overduePaise)} past due` }] : []),
    ...(pending > 0 ? [{ key: "leave", href: "/my/leave", icon: CalendarClock, title: `${pending} leave ${pending === 1 ? "request" : "requests"} ${me ? "awaiting a decision" : `${pending === 1 ? "needs" : "need"} your approval`}`, description: me ? "Your parent or mentor decides" : "Approve or decline in Leave" }] : []),
    ...(!me && isMinor(s.birthDate, today) && !s.parentConsentAt ? [{ key: "consent", href: "/my/profile", icon: UserRoundCheck, title: "Give consent so the college can message you", description: `${s.name.split(" ")[0]} is under 18` }] : []),
  ];

  return (
    <>
      <PageHeader
        title={`Hi, ${v.name.split(" ")[0]}`}
        description={me ? `${s.rollNo} · ${s.programme} · Year ${s.year}` : `Viewing ${s.name}`}
      />

      <StatStrip>
        <StatCard
          label={`${who} attendance`}
          value={overall === null ? "–" : `${overall}%`}
          tone={overall !== null && isShortage(overall, s.cutoff) ? "absent" : "default"}
          hint={overall === null ? "No classes marked yet" : `${short.length} subjects below the ${s.cutoff}% line`}
          href="/my/attendance"
        />
        <StatCard
          label={`${who} internal marks`}
          value={entered.length === 0 ? "–" : `${obtained} / ${possible}`}
          href="/my/marks"
        />
        <StatCard
          label={`${who} fees due`}
          value={rupees(totalPaise)}
          hint={overdueCount > 0 ? `${overdueCount} overdue` : undefined}
          href="/my/fees"
        />
        <StatCard
          label={`${who} leave`}
          value={pending}
          hint={me ? undefined : awaitingParent > 0 ? `${awaitingParent} needs your approval` : undefined}
          href="/my/leave"
        />
      </StatStrip>

      {me && (
        <>
          <SectionHeading title="Today" count={todayRows.length} action={<Link href="/my/timetable" className="font-medium text-foreground underline-offset-4 hover:underline">Full timetable</Link>} />
          {todayRows.length === 0 ? <EmptyState title="No classes today." /> : (
            <TodayCarousel start={start}>
              {todayRows.map((c, i) => (
                <div key={`${c.period}-${c.startTime}`} className="flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 text-sm shadow-sheet">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {c.subject ?? c.label ?? "Period"}
                      {cur && i === start && <span className="ml-2 rounded-full bg-data-soft px-2 py-0.5 align-middle text-xs font-medium text-data">{cur.running ? "Now" : "Next"}</span>}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">{c.startTime}–{c.endTime}</span>
                  </span>
                  {c.subjectId !== null && (c.session
                    ? c.session.status
                      ? <StatusPill tone={STATUS[c.session.status].tone}>{STATUS[c.session.status].label}</StatusPill>
                      : <StatusPill>Marked</StatusPill>
                    : c.startTime <= now && <StatusPill>Not marked yet</StatusPill>)}
                </div>
              ))}
            </TodayCarousel>
          )}
        </>
      )}

      <SectionHeading title="Needs attention" count={attention.length} />
      {attention.length === 0 ? <EmptyState title="All clear." /> : (
        <div className="space-y-2">
          {attention.map((a) => (
            <ModuleCard key={a.key} href={a.href} icon={a.icon} title={a.title} description={a.description} />
          ))}
        </div>
      )}
    </>
  );
}
