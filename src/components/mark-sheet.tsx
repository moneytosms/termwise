import { SECTIONS, SECTION_LABEL, type Section } from "@/domain/marks";
import type { MarkSheet } from "@/server/marksheet";
import { Mark } from "@/components/mark";

const ist = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" });

/** Term mark sheet for print (A4). Pending subjects show no numbers. */
export function MarkSheet({ sheet, hash, verifyUrl, qrSvg }: { sheet: MarkSheet; hash: string; verifyUrl: string; qrSvg: string }) {
  const c = sheet.campus;
  const s = sheet.student;
  const address = [c.addressLine1, c.addressLine2, [c.city, c.state, c.pincode].filter(Boolean).join(", ")].filter(Boolean);
  const contact = [c.phone, c.email, c.website].filter(Boolean).join(" · ");
  const regs = [c.registrationNo && `Registration no: ${c.registrationNo}`, c.gstin && `GSTIN: ${c.gstin}`].filter(Boolean);
  const locked = sheet.subjects.flatMap((x) => (x.status === "locked" ? [x] : []));
  const columns = SECTIONS.filter((sec: Section) => locked.some((x) => x.sections.some((k) => k.section === sec)));
  const grouped = hash.slice(0, 32).replace(/(.{4})(?=.)/g, "$1 ");
  const span = columns.length + 2;

  return (
    <article className="mark-sheet mx-auto flex w-full max-w-[210mm] flex-col gap-6 rounded-xl bg-card p-6 shadow-sheet print:rounded-none print:p-0 print:shadow-none">
      <header className="flex gap-4 border-b pb-4">
        {c.logoDataUrl && <img src={c.logoDataUrl} alt="" className="size-20 shrink-0 object-contain" />}
        <div className="min-w-0 flex-1 space-y-0.5 text-sm">
          <p className="text-lg font-semibold">{c.legalName ?? c.name}</p>
          {c.tagline && <p className="italic text-muted-foreground">{c.tagline}</p>}
          {c.affiliation && <p>{c.affiliation}</p>}
          {address.map((a) => <p key={a}>{a}</p>)}
          {contact && <p>{contact}</p>}
          {regs.length > 0 && <p>{regs.join(" · ")}</p>}
        </div>
      </header>

      <div>
        <h1 className="text-[1.5rem] leading-tight font-semibold tracking-[-0.02em]">Term mark sheet</h1>
        <p className="text-sm text-muted-foreground">{s.programme} · {s.batch} · Year {s.year}, semester {s.semester}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
        <div><dt className="text-muted-foreground">Student</dt><dd className="font-medium">{s.name}</dd></div>
        <div><dt className="text-muted-foreground">Roll no</dt><dd className="font-medium tabular-nums">{s.rollNo}</dd></div>
        <div><dt className="text-muted-foreground">Programme</dt><dd className="font-medium">{s.programme}</dd></div>
        <div><dt className="text-muted-foreground">Year / semester</dt><dd className="font-medium tabular-nums">{s.year} / {s.semester}</dd></div>
      </dl>

      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left text-sm tabular-nums">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="py-2 pr-4 font-medium">Code</th>
              <th className="py-2 pr-4 font-medium">Subject</th>
              {columns.map((sec) => <th key={sec} className="py-2 pr-4 text-right font-medium">{SECTION_LABEL[sec]}</th>)}
              <th className="py-2 pr-4 text-right font-medium">Theory</th>
              <th className="py-2 text-right font-medium">Final /100</th>
            </tr>
          </thead>
          <tbody>
            {sheet.subjects.map((x) => x.status === "pending" ? (
              <tr key={x.code} className="border-b border-rule last:border-0">
                <td className="py-2 pr-4">{x.code}</td>
                <td className="py-2 pr-4">{x.name}</td>
                <td colSpan={span} className="py-2 text-right text-muted-foreground">Pending</td>
              </tr>
            ) : (
              <tr key={x.code} className="border-b border-rule last:border-0">
                <td className="py-2 pr-4">{x.code}</td>
                <td className="py-2 pr-4">{x.name}</td>
                {columns.map((sec) => {
                  const k = x.sections.find((y) => y.section === sec);
                  return <td key={sec} className="py-2 pr-4 text-right">{k ? `${k.marks} / ${k.max}` : "–"}</td>;
                })}
                <td className="py-2 pr-4 text-right">{x.internal} / {x.theoryMax}</td>
                <td className="py-2 text-right font-medium">{x.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-end gap-4">
        <div className="size-24 shrink-0 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qrSvg }} aria-label="Scan to verify this mark sheet" role="img" />
        <div className="min-w-0 space-y-1 text-xs">
          <p className="text-muted-foreground">Verification hash</p>
          <p className="font-mono break-all">{grouped}</p>
          <p className="text-muted-foreground">Scan the code or <a href={verifyUrl} data-testid="verify-link" className="underline underline-offset-4">open the verify page</a> to check this mark sheet.</p>
        </div>
      </div>

      <footer className="mt-auto flex items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
        <p className="flex items-center gap-2"><Mark className="size-4" /> Generated by Termwise</p>
        <p>Generated {ist(new Date())}. Only moderated (locked) subjects carry final marks.</p>
      </footer>

      <style>{`
        @page { size: A4; margin: 12mm; }
        .mark-sheet { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        @media print {
          .no-print { display: none !important; }
          .mark-sheet { box-shadow: none !important; min-height: 0; }
        }
      `}</style>
    </article>
  );
}
