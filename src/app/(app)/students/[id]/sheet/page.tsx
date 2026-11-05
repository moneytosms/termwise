import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { MarkSheet } from "@/components/mark-sheet";
import { AccessError, assertStudentAccess, requireAdmin } from "@/server/access";
import { loadMarkSheet, sheetHash } from "@/server/marksheet";
import { PrintButton } from "@/app/(portal)/my/marks/sheet/print-button";

export default async function StudentSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const v = await requireAdmin();
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const studentId = Number(id);
  try {
    await assertStudentAccess(v, studentId);
  } catch (e) {
    if (e instanceof AccessError) notFound();
    throw e;
  }
  const sheet = await loadMarkSheet(studentId);
  if (!sheet) notFound();
  const hash = sheetHash(sheet);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost"}`;
  const verifyUrl = `${origin}/verify/marksheet/${studentId}?h=${hash}`;
  const qrSvg = await QRCode.toString(verifyUrl, { type: "svg", margin: 0 });

  return (
    <div className="mx-auto max-w-4xl py-6">
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/students?student=${studentId}`} />}>
          <ArrowLeft className="size-3.5" aria-hidden />Back to student
        </Button>
        <PrintButton />
      </div>
      <MarkSheet sheet={sheet} hash={hash} verifyUrl={verifyUrl} qrSvg={qrSvg} />
    </div>
  );
}
