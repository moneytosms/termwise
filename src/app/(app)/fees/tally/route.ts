import { and, asc, eq, gte, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { istDate } from "@/domain/attendance";
import { tallyReceiptsXml } from "@/domain/tally";
import { getViewer, studentScope } from "@/server/access";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { batch, feeInstalment, feePayment, programme, student } from "@/server/schema";

const DAY = 86_400_000;
const rangeSchema = z.object({ from: z.iso.date(), to: z.iso.date() })
  .refine((r) => r.from <= r.to, "from must be on or before to.")
  .refine((r) => Date.parse(r.to) - Date.parse(r.from) <= 365 * DAY, "Range is at most 366 days.");

export async function GET(req: Request) {
  const v = await getViewer();
  if (!v) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  if (v.role !== "office_admin") return NextResponse.json({ error: "Office admin only" }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const parsed = rangeSchema.safeParse({
    from: sp.get("from") || `${istDate().slice(0, 7)}-01`,
    to: sp.get("to") || istDate(),
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { from, to } = parsed.data;

  const start = new Date(`${from}T00:00:00+05:30`);
  const end = new Date(new Date(`${to}T00:00:00+05:30`).getTime() + DAY);
  const xml = await db.transaction(async (tx) => {
    const rows = await tx.select({
      id: feePayment.id, paidAt: feePayment.paidAt, amountPaise: feePayment.amountPaise, mode: feePayment.mode,
      reference: feePayment.reference, instalmentLabel: feeInstalment.label, rollNo: student.rollNo,
      studentName: student.name, programmeCode: programme.code,
    }).from(feePayment)
      .innerJoin(feeInstalment, eq(feePayment.instalmentId, feeInstalment.id))
      .innerJoin(student, eq(feeInstalment.studentId, student.id))
      .innerJoin(batch, eq(student.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(and(studentScope(v), gte(feePayment.paidAt, start), lt(feePayment.paidAt, end)))
      .orderBy(asc(feePayment.paidAt), asc(feePayment.id));
    await audit(tx, v, { action: "fees.tally_export", entity: "campus", entityId: v.campusId, newValue: { from, to, count: rows.length } });
    return tallyReceiptsXml(rows.map((r) => ({ ...r, receiptNo: `R-${String(r.id).padStart(6, "0")}` })));
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="tally-receipts-${from}-${to}.xml"`,
    },
  });
}
