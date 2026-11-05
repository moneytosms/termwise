import { and, count, desc, eq } from "drizzle-orm";
import { PageHeader, Panel, SectionHeading, StatusPill, type Tone } from "@/components/page";
import { EmptyState } from "@/components/states";
import { categoryLabel, genderLabel } from "@/domain/applicants";
import { istDate } from "@/domain/attendance";
import { isMinor } from "@/domain/templates";
import { db } from "@/server/db";
import { requirePortal } from "@/server/portal";
import { portalStudent } from "@/server/portal-data";
import { message, portalRequest, student, studentDocument } from "@/server/schema";
import { ConsentPanel } from "./consent-panel";
import { CorrectionForm } from "./correction-form";

const day = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" });
const dob = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", dateStyle: "medium" });

const DOC: Record<"verified" | "received" | "pending", { tone: Tone; label: string }> = {
  verified: { tone: "ok", label: "Verified" },
  received: { tone: "default", label: "Received" },
  pending: { tone: "late", label: "Pending" },
};

export default async function ProfilePage() {
  const v = await requirePortal();
  const s = await portalStudent(v.studentId);
  if (!s) return <EmptyState title="No student record found." />;
  const minor = isMinor(s.birthDate, istDate());

  const [docs, requests, [held], [profile]] = await Promise.all([
    db.select().from(studentDocument).where(eq(studentDocument.studentId, v.studentId)).orderBy(studentDocument.id),
    db.select().from(portalRequest)
      .where(and(eq(portalRequest.studentId, v.studentId), eq(portalRequest.kind, "profile_correction")))
      .orderBy(desc(portalRequest.createdAt)),
    db.select({ n: count() }).from(message)
      .where(and(eq(message.studentId, v.studentId), eq(message.status, "blocked_no_consent"))),
    db.select({ category: student.category, gender: student.gender }).from(student).where(eq(student.id, v.studentId)),
  ]);
  const verified = docs.filter((d) => d.status === "verified").length;

  const facts: [string, React.ReactNode][] = [
    ["Name", s.name],
    ["Roll no", <span key="r" className="tabular-nums">{s.rollNo}</span>],
    ["Programme", s.programme],
    ["Batch", s.batch],
    ["Year / semester", `Year ${s.year}, semester ${s.semester}`],
    ["Campus", s.campus],
    ["Date of birth", dob(s.birthDate)],
    ["Category", categoryLabel(profile.category)],
    ["Gender", genderLabel(profile.gender)],
    ["Mentor", s.mentor ?? "Not assigned"],
    ["Guardian", s.guardianName ?? "Not recorded"],
    ["Guardian phone", s.guardianPhone ?? "Not recorded"],
  ];

  return (
    <>
      <PageHeader title="Profile" />

      <Panel title="Student record">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 font-medium text-pretty">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      {v.role === "parent" && (
        <>
          <SectionHeading title="Your children" count={v.children.length} />
          <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card text-sm shadow-sheet">
            {v.children.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 truncate font-medium">{c.name}</span>
                <span className="flex-none text-muted-foreground tabular-nums">{c.rollNo} · {c.relation ?? "Guardian"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted-foreground">Switch child from the sidebar.</p>

          <SectionHeading title="Consent (DPDP)" />
          {minor ? (
            <ConsentPanel givenOn={s.parentConsentAt ? day(s.parentConsentAt) : null} held={held.n} />
          ) : (
            <p className="text-sm text-muted-foreground">Consent isn&apos;t needed: {s.name} is an adult.</p>
          )}
        </>
      )}

      <SectionHeading title="Admission documents" action={<span className="text-muted-foreground tabular-nums">{verified} of {docs.length} verified</span>} />
      {docs.length === 0 ? <EmptyState title="No documents on file yet." /> : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card text-sm shadow-sheet">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0 truncate">{d.name}</span>
              <span className="flex flex-none items-center gap-3">
                <StatusPill tone={DOC[d.status].tone}>{DOC[d.status].label}</StatusPill>
                {d.fileId && <a href={`/api/documents/${d.fileId}`} target="_blank" rel="noreferrer" className="underline underline-offset-4">View</a>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-sm text-muted-foreground">Bring pending originals to the admissions office.</p>

      <SectionHeading title="Ask for a correction" />
      <div className="rounded-xl bg-card p-4 shadow-sheet md:p-5">
        <CorrectionForm />
      </div>

      <SectionHeading title="Your requests" count={requests.length} />
      {requests.length === 0 ? <p className="text-sm text-muted-foreground">No correction requests yet.</p> : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r.id} className="rounded-xl bg-card p-4 text-sm shadow-sheet">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{day(r.createdAt)} · {r.fromName}</span>
                {r.status === "done" ? <StatusPill tone="ok">Done</StatusPill> : <StatusPill>Open</StatusPill>}
              </div>
              <p className="mt-2 whitespace-pre-line text-pretty">{r.body}</p>
              {r.reply && (
                <p className="mt-3 border-t border-border pt-3 text-muted-foreground">
                  <span className="font-medium text-foreground">Office reply: </span>{r.reply}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
