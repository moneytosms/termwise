import Link from "next/link";
import { PageHeader, Panel } from "@/components/page";
import { requireViewer } from "@/server/access";
import { AdminHome, CHARTS, type ChartKey } from "./admin-home";
import { FacultyHome } from "./faculty-home";
import { can } from "@/domain/roles";

// The narrower office roles get a plain landing page: the dashboard holds fees, attendance and flags they don't see.
const LANDING = [
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

export default async function HomePage({ searchParams }: { searchParams: Promise<{ programme?: string; chart?: string }> }) {
  const v = await requireViewer();
  if (can(v.role, "teach")) return <FacultyHome name={v.name} />;
  if (!can(v.role, "attendance")) {
    return (
      <>
        <PageHeader title="Home" description={`Welcome, ${v.name}.`} />
        <Panel title="Your work">
          <ul className="divide-y divide-rule">
            {LANDING.filter((l) => can(v.role, l.cap)).map((l) => (
              <li key={l.href} className="py-2.5 first:pt-0 last:pb-0"><Link href={l.href} className="font-medium hover:underline">{l.label}</Link></li>
            ))}
          </ul>
        </Panel>
      </>
    );
  }
  const { programme, chart } = await searchParams;
  return <AdminHome viewer={v} programme={programme} chart={chart && chart in CHARTS ? (chart as ChartKey) : "attendance"} />;
}
