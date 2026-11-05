"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecordModal } from "@/components/record-modal";
import { EmptyState } from "@/components/states";
import { SectionHeading, StatusPill, type Tone } from "@/components/page";
import { Initials } from "../students/students-table";
import { CATEGORY_LABEL, checklistComplete, checklistProgress, type ApplicantCategory, type DocStatus } from "@/domain/applicants";
import { istDate } from "@/domain/attendance";
import { isMinor } from "@/domain/templates";
import { saveConsent, updateApplicantDocument } from "./actions";
import type { ApplicantDetail } from "./queries";

const STATUS: Record<ApplicantDetail["status"], { label: string; tone: Tone }> = {
  applied: { label: "Applied", tone: "default" },
  confirmed: { label: "Confirmed", tone: "ok" },
  rejected: { label: "Rejected", tone: "absent" },
};
const DOC_LABEL: Record<DocStatus, string> = { pending: "Pending", received: "Received", verified: "Verified" };
const DOC_STATES: DocStatus[] = ["pending", "received", "verified"];
const card = "rounded-xl bg-card p-3.5 text-sm shadow-sheet";

/** Whole years on `today`, using the IST calendar dates as YYYY-MM-DD strings. */
function ageOn(birthDate: string, today: string) {
  const y = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return today.slice(5) < birthDate.slice(5) ? y - 1 : y;
}

export function ApplicantPanel({ detail }: { detail: ApplicantDetail | null }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const close = () => router.push("/applicants", { scroll: false });
  const d = detail;

  if (!d) {
    return (
      <RecordModal title="Applicant" description="Not available" onClose={close}>
        <EmptyState title="This applicant isn't available to you." />
      </RecordModal>
    );
  }

  const today = istDate();
  const minor = isMinor(d.birthDate, today);
  const editable = d.status === "applied";
  const progress = checklistProgress(d.checklist);
  const complete = checklistComplete(d.checklist);

  const setDoc = (name: string, status: DocStatus) => start(async () => {
    const fd = new FormData();
    fd.set("applicantId", String(d.id));
    fd.set("name", name);
    fd.set("status", status);
    const r = await updateApplicantDocument(fd);
    if (r.error) toast.error(r.error); else router.refresh();
  });

  const consent = (fd: FormData) => start(async () => {
    fd.set("applicantId", String(d.id));
    const r = await saveConsent(fd);
    if (r.error) toast.error(r.error); else { toast.success("Consent saved."); router.refresh(); }
  });

  return (
    <RecordModal
      wide
      title={d.name}
      description={`${d.programme} · ${d.batch}`}
      leading={<Initials name={d.name} />}
      onClose={close}
      nav={{ key: "applicants", id: String(d.id), href: (id) => `/applicants?applicant=${id}` }}
      footer={<div className="flex flex-wrap gap-2">{/* admission actions */}</div>}>
      <div className="space-y-2 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={STATUS[d.status].tone}>{STATUS[d.status].label}</StatusPill>
          {minor && <StatusPill tone="late">Minor</StatusPill>}
          {d.status === "rejected" && d.rejectReason && <span className="text-sm text-muted-foreground">{d.rejectReason}</span>}
        </div>
      </div>

      <div className="space-y-6 pb-8">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className={card}><dt className="text-muted-foreground">Birth date</dt><dd className="mt-1 tabular-nums">{d.birthDate}</dd></div>
          <div className={card}><dt className="text-muted-foreground">Age</dt><dd className="mt-1 tabular-nums">{ageOn(d.birthDate, today)}</dd></div>
          <div className={card}><dt className="text-muted-foreground">Category</dt><dd className="mt-1">{CATEGORY_LABEL[d.category as ApplicantCategory] ?? d.category}</dd></div>
          <div className={card}><dt className="text-muted-foreground">Guardian</dt><dd className="mt-1">{d.guardianName}</dd></div>
          <div className={card}><dt className="text-muted-foreground">Guardian phone</dt><dd className="mt-1 tabular-nums">{d.guardianPhone}</dd></div>
          <div className={card}><dt className="text-muted-foreground">Guardian email</dt><dd className="mt-1 break-all">{d.guardianEmail ?? "–"}</dd></div>
        </dl>

        {minor && (
          <section className="space-y-2">
            <SectionHeading title="Parent consent" />
            <form className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); consent(new FormData(e.currentTarget)); }}>
              <label className="grid gap-1.5 text-sm font-medium">
                Consent date
                <Input type="date" name="consentDate" disabled={!editable || busy}
                  defaultValue={d.parentConsentAt ? istDate(d.parentConsentAt) : ""} />
              </label>
              {editable && <Button type="submit" size="sm" disabled={busy}>Save consent</Button>}
            </form>
          </section>
        )}

        <section className="space-y-2">
          <SectionHeading title="Documents" count={progress.total} />
          <p className="text-sm text-muted-foreground">
            {progress.verified}/{progress.total} verified{complete ? " · complete" : ""}
          </p>
          {d.checklist.length === 0 ? <p className="text-sm text-muted-foreground">No documents apply to this applicant.</p> : (
            <ul className="space-y-2">
              {d.checklist.map((item) => (
                <li key={item.name} className={`flex flex-wrap items-center justify-between gap-2 ${card}`}>
                  <span className="min-w-0 font-medium">{item.name}</span>
                  {editable ? (
                    <span role="group" aria-label={`Status of ${item.name}`} className="flex flex-wrap gap-1">
                      {DOC_STATES.map((s) => (
                        <Button key={s} size="sm" disabled={busy} aria-pressed={item.status === s}
                          variant={item.status === s ? "default" : "ghost"} onClick={() => setDoc(item.name, s)}>
                          {DOC_LABEL[s]}
                        </Button>
                      ))}
                    </span>
                  ) : (
                    <StatusPill>{DOC_LABEL[item.status]}</StatusPill>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!editable && <p className="text-sm text-muted-foreground">Documents are locked because this applicant is {STATUS[d.status].label.toLowerCase()}.</p>}
        </section>
      </div>
    </RecordModal>
  );
}
