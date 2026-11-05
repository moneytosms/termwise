import { PageHeader } from "@/components/page";
import { requireViewer } from "@/server/access";
import { getStudentDetail, listStudents } from "./queries";
import { StudentPanel } from "./student-panel";
import { StudentsTable } from "./students-table";
import { can } from "@/domain/roles";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ student?: string; flag?: string; attendance?: string; batch?: string }> }) {
  const v = await requireViewer();
  const { student, flag, attendance, batch } = await searchParams;
  const rows = await listStudents(v);
  const detail = student && /^\d+$/.test(student) ? await getStudentDetail(v, Number(student)).catch(() => null) : null;
  return (
    <>
      <PageHeader title="Students" description={<>{can(v.role, "teach") ? "Your subjects and mentees" : `${rows.length} on this campus`} · <span className="text-foreground">{rows.filter((r) => r.shortage).length} below the attendance line</span></>} />
      <StudentsTable rows={rows} isAdmin={can(v.role, "campus_students")} initialFilters={{ ...(batch && { Batch: batch }), ...(flag && { "At risk": "Flagged" }), ...(attendance === "Shortage" && { Attendance: "Shortage" }) }} />
      {student && <StudentPanel detail={detail} isAdmin={can(v.role, "campus_students")} />}
    </>
  );
}
