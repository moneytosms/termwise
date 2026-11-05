import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states";
import { requirePortal } from "@/server/portal";
import { portalStudent } from "@/server/portal-data";
import { SUBJECT_MAX, studentMarks } from "../queries";
import { PrintButton } from "./print-button";

export default async function MarkSheetPage() {
  const v = await requirePortal();
  const s = await portalStudent(v.studentId);
  if (!s) notFound();
  const locked = (await studentMarks(v.studentId, s.batchId)).filter((x) => x.status === "locked");
  const columns: string[] = [];
  for (const x of locked) for (const c of x.comps) if (!columns.includes(c.name)) columns.push(c.name);
  const generated = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/my/marks" />}>
          <ArrowLeft className="size-3.5" aria-hidden />Back to marks
        </Button>
        {locked.length > 0 && <PrintButton />}
      </div>

      {locked.length === 0 ? <EmptyState title="No subject has been moderated yet." /> : (
        <article className="rounded-xl bg-card p-5 shadow-sheet md:p-8 print:rounded-none print:p-0 print:shadow-none">
          <header className="border-b border-border pb-4 text-center">
            <p className="text-sm text-muted-foreground">{s.campus}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">Internal mark sheet</h1>
          </header>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
            <div><dt className="text-muted-foreground">Student</dt><dd className="font-medium">{s.name}</dd></div>
            <div><dt className="text-muted-foreground">Roll no</dt><dd className="font-medium tabular-nums">{s.rollNo}</dd></div>
            <div><dt className="text-muted-foreground">Programme</dt><dd className="font-medium">{s.programme}</dd></div>
            <div><dt className="text-muted-foreground">Year / semester</dt><dd className="font-medium tabular-nums">{s.year} / {s.semester}</dd></div>
          </dl>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm tabular-nums">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Code</th>
                  <th className="py-2 pr-4 font-medium">Subject</th>
                  {columns.map((c) => <th key={c} className="py-2 pr-4 text-right font-medium">{c}</th>)}
                  <th className="py-2 text-right font-medium">Total /{SUBJECT_MAX}</th>
                </tr>
              </thead>
              <tbody>
                {locked.map((x) => (
                  <tr key={x.id} className="border-b border-rule last:border-0">
                    <td className="py-2 pr-4">{x.code}</td>
                    <td className="py-2 pr-4">{x.name}</td>
                    {columns.map((n) => {
                      const c = x.comps.find((k) => k.name === n);
                      return <td key={n} className="py-2 pr-4 text-right">{c?.marks == null ? "–" : `${c.marks} / ${c.max}`}</td>;
                    })}
                    <td className="py-2 text-right font-medium">{x.obtained}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="mt-6 text-xs text-muted-foreground">
            Generated {generated}. Only moderated (locked) subjects are listed.
          </footer>
        </article>
      )}
    </div>
  );
}
