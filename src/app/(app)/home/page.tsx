import Link from "next/link";
import { PageHeader, Panel } from "@/components/page";
import { requireViewer } from "@/server/access";
import { AdminHome, CHARTS, type ChartKey } from "./admin-home";
import { FacultyHome } from "./faculty-home";
import { HodHome, LANDING } from "./hod-home";
import { can } from "@/domain/roles";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ programme?: string; chart?: string }> }) {
  const v = await requireViewer();
  if (can(v.role, "teach")) return <FacultyHome name={v.name} />;
  if (can(v.role, "dept_students")) return <HodHome viewer={v} />;
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
