import { PageHeader } from "@/components/page";
import { requireAdmin } from "@/server/access";
import { listBatches } from "../setup/queries";
import { ApplicantPanel } from "./applicant-panel";
import { ApplicantsTable } from "./applicants-table";
import { ImportDialog } from "./import-dialog";
import { getApplicantDetail, listApplicants } from "./queries";

export default async function ApplicantsPage({ searchParams }: { searchParams: Promise<{ applicant?: string }> }) {
  const v = await requireAdmin();
  const { applicant } = await searchParams;
  const rows = await listApplicants(v.campusId);
  const batches = await listBatches(v.campusId);
  const detail = applicant && /^\d+$/.test(applicant) ? await getApplicantDetail(v.campusId, Number(applicant)) : null;
  return (
    <>
      <PageHeader title="Applicants" description={`${rows.length} on this campus · ${rows.filter((r) => r.complete).length} with a complete checklist`}
        actions={<ImportDialog batches={batches.map((b) => ({ id: b.id, code: b.code, programme: b.programme }))} />} />
      <ApplicantsTable rows={rows} initialFilters={{}} />
      {applicant && <ApplicantPanel detail={detail} />}
    </>
  );
}
