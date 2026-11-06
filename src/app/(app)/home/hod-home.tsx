import Link from "next/link";
import { EmptyState } from "@/components/states";
import { PageHeader, Panel, StatCard, StatStrip, StatusPill } from "@/components/page";
import { can } from "@/domain/roles";
import type { Viewer } from "@/server/access";
import { campusLeave } from "@/app/(app)/leave/queries";
import { listRisk } from "@/app/(app)/risk/queries";
import { listStudents } from "@/app/(app)/students/queries";
import { listSubjects } from "@/app/(app)/marks/queries";
import { STATUS } from "@/app/(app)/marks/shared";

// The narrower office roles get a plain landing page: the dashboard holds fees, attendance and flags they don't see.
export const LANDING = [
  { cap: "admissions", href: "/applicants", label: "Applicants" },
  { cap: "campus_students", href: "/students", label: "Students" },
  { cap: "dept_students", href: "/students", label: "Department students" },
  { cap: "attendance_view", href: "/attendance", label: "Department attendance" },
  { cap: "marks_view", href: "/marks", label: "Department marks" },
  { cap: "risk_view", href: "/risk", label: "At-risk flags" },
  { cap: "dept_leave", href: "/leave", label: "Department leave" },
  { cap: "moderate_marks", href: "/marks", label: "Marks" },
  { cap: "appeals", href: "/requests", label: "Requests" },
  { cap: "reports", href: "/reports", label: "Reports" },
  { cap: "fees", href: "/fees", label: "Fees" },
  { cap: "staff_leave", href: "/leave", label: "Staff leave" },
  { cap: "setup_faculty", href: "/setup", label: "College setup" },
] as const;

/** The head of department's home: read-only figures and subjects for their own department. */
export async function HodHome({ viewer: v }: { viewer: Viewer }) {
  const [students, flags, leave, subjects] = await Promise.all([listStudents(v), listRisk(v), campusLeave(v), listSubjects(v)]);
  const active = students.filter((s) => !s.alumni);
  const short = students.filter((s) => s.shortage).length;
  return (
    <>
      <PageHeader title="Home" description={`Welcome, ${v.name}. Your department only.`} />
      <StatStrip cols={4}>
        <StatCard label="Students" value={active.length} href="/students" />
        <StatCard label="Below the attendance line" value={short} href="/students?attendance=Shortage" tone={short > 0 ? "absent" : "default"} />
        <StatCard label="Active flags" value={flags.length} href="/risk" tone={flags.length > 0 ? "late" : "default"} />
        <StatCard label="Pending leave" value={leave.pending.length} href="/leave" />
      </StatStrip>
      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start">
        <Panel title="Subjects and marks">
          {subjects.length === 0 ? <EmptyState title="No subjects in this department." /> : (
            <ul className="divide-y divide-rule">
              {subjects.map((s) => (
                <li key={s.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link href={`/marks/${s.id}`} className="flex items-center gap-3 text-sm hover:underline">
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{s.name}</span><span className="block text-xs text-muted-foreground">{s.code} · {s.batch}</span></span>
                    <StatusPill tone={STATUS[s.status].tone}>{STATUS[s.status].label}</StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Your work">
          <ul className="divide-y divide-rule">
            {LANDING.filter((l) => can(v.role, l.cap)).map((l) => (
              <li key={l.href + l.label} className="py-2.5 first:pt-0 last:pb-0"><Link href={l.href} className="font-medium hover:underline">{l.label}</Link></li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
