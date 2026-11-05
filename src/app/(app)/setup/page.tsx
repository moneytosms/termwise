import Link from "next/link";
import { PageHeader } from "@/components/page";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";
import { can } from "@/domain/roles";
import { requireViewer } from "@/server/access";
import { BatchesTab } from "./batches-tab";
import { CollegeTab } from "./college-tab";
import { CalendarTab } from "./calendar-tab";
import { DocumentsTab } from "./documents-tab";
import { FacultyTab } from "./faculty-tab";
import { FeeStructureTab } from "./fee-structure-tab";
import { ProgrammesTab } from "./programmes-tab";
import { RulesTab } from "./rules-tab";
import { SchemesTab } from "./schemes-tab";
import { getCampus, getRules, listBatches, listCalendar, listDepartments, listFaculty, listFeeStructure, listProgrammes, listRequiredDocuments, listSchemes, listSlots, listStaff, listSubjects } from "./queries";
import { SubjectsTab } from "./subjects-tab";
import { TimetableTab } from "./timetable-tab";

const TABS = [
  { key: "programmes", label: "Programmes" },
  { key: "documents", label: "Documents" },
  { key: "fee-structure", label: "Fee structure" },
  { key: "batches", label: "Batches" },
  { key: "subjects", label: "Subjects" },
  { key: "faculty", label: "Faculty" },
  { key: "calendar", label: "Calendar" },
  { key: "timetable", label: "Timetable" },
  { key: "rules", label: "Rules" },
  { key: "scholarships", label: "Scholarships" },
  { key: "college", label: "College" },
] as const;

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ tab?: string; batch?: string }> }) {
  const v = await requireViewer();
  // Full setup sees every tab; HR sees the faculty list; accounts sees fee structure and scholarships (their actions check "fees").
  const full = can(v.role, "setup");
  const partial = [...(can(v.role, "setup_faculty") ? ["faculty"] : []), ...(can(v.role, "fees") ? ["fee-structure", "scholarships"] : [])];
  const tabs = full ? TABS : TABS.filter((t) => partial.includes(t.key));
  if (tabs.length === 0) redirect("/home");
  const { tab, batch: batchParam } = await searchParams;
  const current = tabs.find((t) => t.key === tab)?.key ?? tabs[0].key;
  const c = v.campusId;

  let body: React.ReactNode;
  if (current === "programmes") {
    body = <ProgrammesTab rows={await listProgrammes(c)} departments={await listDepartments(c)} />;
  } else if (current === "documents") {
    body = <DocumentsTab rows={await listRequiredDocuments(c)} programmes={await listProgrammes(c)} />;
  } else if (current === "fee-structure") {
    body = <FeeStructureTab rows={await listFeeStructure(c)} />;
  } else if (current === "batches") {
    body = <BatchesTab rows={await listBatches(c)} programmes={await listProgrammes(c)} />;
  } else if (current === "subjects") {
    body = <SubjectsTab rows={await listSubjects(c)} batches={await listBatches(c)} faculty={await listFaculty(c)} />;
  } else if (current === "faculty") {
    body = <FacultyTab rows={await listStaff(c)} />;
  } else if (current === "calendar") {
    body = <CalendarTab rows={await listCalendar(c)} />;
  } else if (current === "timetable") {
    const batches = await listBatches(c);
    const picked = batches.find((b) => String(b.id) === batchParam) ?? batches[0];
    body = picked ? (
      <TimetableTab batches={batches} batchId={picked.id} slots={await listSlots(c, picked.id)}
        subjects={(await listSubjects(c)).filter((s) => s.batchId === picked.id)} />
    ) : (
      <EmptyState title="Timetables are set per batch. Add a batch first."
        action={<Button size="sm" variant="outline" nativeButton={false} render={<Link href="/setup?tab=batches" />}>Go to Batches</Button>} />
    );
  } else if (current === "rules") {
    body = <RulesTab rules={await getRules(c)} />;
  } else if (current === "scholarships") {
    body = <SchemesTab rows={await listSchemes(c)} />;
  } else {
    body = <CollegeTab campus={await getCampus(c)} />;
  }

  return (
    <>
      <PageHeader title="College setup" description="Programmes, batches, subjects, faculty, calendar, timetable and rules for this campus." />
      <nav aria-label="Setup sections" className="mb-6 flex gap-1 overflow-x-auto border-b">
        {tabs.map((t) => {
          const active = t.key === current;
          return (
            <Link key={t.key} href={`/setup?tab=${t.key}`} aria-current={active ? "page" : undefined}
              className={cn("-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors",
                active ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t.label}
            </Link>
          );
        })}
      </nav>
      {body}
    </>
  );
}
