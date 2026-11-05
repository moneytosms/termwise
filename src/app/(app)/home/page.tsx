import { requireViewer } from "@/server/access";
import { AdminHome, CHARTS, type ChartKey } from "./admin-home";
import { FacultyHome } from "./faculty-home";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ programme?: string; chart?: string }> }) {
  const v = await requireViewer();
  if (v.role === "faculty") return <FacultyHome name={v.name} />;
  const { programme, chart } = await searchParams;
  return <AdminHome viewer={v} programme={programme} chart={chart && chart in CHARTS ? (chart as ChartKey) : "attendance"} />;
}
