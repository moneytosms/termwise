import { requireViewer } from "@/server/access";
import { AdminHome } from "./admin-home";
import { FacultyHome } from "./faculty-home";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ programme?: string }> }) {
  const v = await requireViewer();
  if (v.role === "faculty") return <FacultyHome name={v.name} />;
  const id = Number((await searchParams).programme);
  return <AdminHome viewer={v} programmeId={Number.isInteger(id) ? id : undefined} />;
}
