import { PageHeader, Panel } from "@/components/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { istDate } from "@/domain/attendance";
import { REPORTS, type ReportKey, type Row } from "@/domain/reports";
import { runReport } from "@/app/(app)/reports/queries";
import { cn } from "@/lib/utils";
import { campusList } from "../queries";

const NAAC = REPORTS.filter((r) => r.key.startsWith("naac_"));

export default async function TrustNaac() {
  const month = istDate().slice(0, 7);
  const campuses = await campusList();
  const results = await Promise.all(campuses.map((c) =>
    Promise.all(NAAC.map((r) => runReport({ campusId: c.id }, r.key as ReportKey, { month })))));

  return (
    <>
      <PageHeader title="NAAC returns" description="All campuses, read-only. Figures are for the current month." />
      <div className="grid gap-4">
        {NAAC.map((meta, i) => {
          const body = campuses.flatMap((c, ci) => {
            const { columns, rows } = results[ci][i];
            const lines: Row[] = rows.length ? rows : [{}];
            return lines.map((r, ri) => ({ key: `${c.id}-${ri}`, campus: ri === 0 ? c.name : "", cells: columns.map((col) => r[col.key] ?? "—") }));
          });
          return (
            <Panel key={meta.key} title={meta.title} className="min-w-0">
              {meta.note && <p className="mb-3 text-sm text-muted-foreground">{meta.note}</p>}
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Campus</TableHead>
                      {meta.columns.map((c) => <TableHead key={c.key} className="whitespace-nowrap">{c.label}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {body.map((b) => (
                      <TableRow key={b.key}>
                        <TableCell className="whitespace-nowrap">{b.campus}</TableCell>
                        {b.cells.map((cell, k) => (
                          <TableCell key={k} className={cn("whitespace-nowrap", typeof cell === "number" && "tabular-nums")}>{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
