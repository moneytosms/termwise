import { requireViewer } from "@/server/access";
import { AdminHome } from "./admin-home";
import { FacultyHome } from "./faculty-home";

export default async function HomePage() {
  const v = await requireViewer();
  return v.role === "faculty" ? <FacultyHome name={v.name} /> : <AdminHome viewer={v} />;
}
