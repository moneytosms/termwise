import { matches } from "@/domain/marksheet";
import { loadMarkSheet, sheetHash } from "@/server/marksheet";

export const dynamic = "force-dynamic";

/** "Ankit Kumar Panda" -> "Ankit P." */
const mask = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]}.` : parts[0];
};

export default async function VerifyMarkSheetPage({ params, searchParams }: {
  params: Promise<{ studentId: string }>; searchParams: Promise<{ h?: string }>;
}) {
  const { studentId } = await params;
  const { h } = await searchParams;

  const sheet = /^\d{1,9}$/.test(studentId) ? await loadMarkSheet(Number(studentId)) : null;
  const valid = !!sheet && !!h && matches(h, sheetHash(sheet));

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <article className="grid gap-6 rounded-md border bg-card p-6">
        {valid && sheet.campus.logoDataUrl && <img src={sheet.campus.logoDataUrl} alt="" className="mx-auto h-16 object-contain" />}
        {valid ? (
          <>
            <div className="text-center">
              <p className="text-sm font-medium text-emerald-700">Genuine mark sheet</p>
              <p className="mt-1 text-lg font-semibold">{sheet.campus.legalName ?? sheet.campus.name}</p>
            </div>
            <dl className="divide-y text-sm">
              {[
                ["Student", mask(sheet.student.name)],
                ["Roll no", sheet.student.rollNo],
                ["Semester", String(sheet.student.semester)],
              ].map(([k, val]) => (
                <div key={k} className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right tabular-nums">{val}</dd>
                </div>
              ))}
            </dl>
            <table className="w-full text-left text-sm tabular-nums">
              <thead className="border-b text-muted-foreground">
                <tr><th className="py-2 font-medium">Code</th><th className="py-2 text-right font-medium">Final /100</th></tr>
              </thead>
              <tbody>
                {sheet.subjects.flatMap((x) => (x.status === "locked" ? [
                  <tr key={x.code} className="border-b last:border-0"><td className="py-2">{x.code}</td><td className="py-2 text-right">{x.total}</td></tr>,
                ] : []))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="text-center font-medium">Not genuine: this mark sheet does not match college records.</p>
        )}
      </article>
    </main>
  );
}
