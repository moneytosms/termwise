import { notFound } from "next/navigation";
import { PageHeader, SectionHeading, StatusPill } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { AccessError, requireViewer } from "@/server/access";
import { getSheet, getSubjectHistory } from "../queries";
import { STATUS } from "../shared";
import { MarksSheet } from "./marks-sheet";

export default async function MarksSubjectPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const v = await requireViewer();
  const { subjectId } = await params;
  if (!/^\d+$/.test(subjectId)) notFound();
  const id = Number(subjectId);
  const data = await getSheet(v, id).catch((e) => {
    if (e instanceof AccessError) return null;
    throw e;
  });
  if (!data) notFound();
  const s = data.subject;
  const isAdmin = v.role === "office_admin";
  const history = isAdmin ? await getSubjectHistory(v, id) : [];

  return (
    <>
      <PageHeader
        title={`${s.code} ${s.name}`}
        description={`Batch ${s.batch} · ${s.faculty ?? "No faculty assigned"}`}
        actions={<>
          <StatusPill tone={STATUS[s.status].tone}>{STATUS[s.status].label}</StatusPill>
          {isAdmin && s.status === "locked" && (
            <a href={`/marks/${id}/export`} className={buttonVariants({ variant: "outline" })}>Export CSV</a>
          )}
        </>}
      />
      {isAdmin && s.status === "locked" && (
        <p className="-mt-4 mb-6 text-xs text-muted-foreground">Export columns are assumed; the university&apos;s upload format was not supplied.</p>
      )}

      <MarksSheet data={data} role={v.role} />

      {isAdmin && (
        <>
          <SectionHeading title="History" count={history.length} />
          {history.length === 0 ? <p className="text-sm text-muted-foreground">No changes recorded.</p> : (
            <>
              <ul className="space-y-1 text-sm">
                {history.map((h) => (
                  <li key={h.id}>
                    <span className="text-muted-foreground">{new Date(h.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>{" "}
                    <span className="font-mono">{h.action}</span> by {h.actorName}{h.reason && `: ${h.reason}`}
                  </li>
                ))}
              </ul>
              {history.length === 50 && <p className="mt-2 text-xs text-muted-foreground">Showing the latest 50 changes.</p>}
            </>
          )}
        </>
      )}
    </>
  );
}
