import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { MarkSheet } from "@/components/mark-sheet";
import { requirePortal } from "@/server/portal";
import { loadMarkSheet, sheetHash } from "@/server/marksheet";
import { PrintButton } from "./print-button";

export default async function MarkSheetPage() {
  const v = await requirePortal();
  const sheet = await loadMarkSheet(v.studentId);
  if (!sheet) notFound();
  const hash = sheetHash(sheet);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost"}`;
  const verifyUrl = `${origin}/verify/marksheet/${v.studentId}?h=${hash}`;
  const qrSvg = await QRCode.toString(verifyUrl, { type: "svg", margin: 0 });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/my/marks" />}>
          <ArrowLeft className="size-3.5" aria-hidden />Back to marks
        </Button>
        <PrintButton />
      </div>
      <MarkSheet sheet={sheet} hash={hash} verifyUrl={verifyUrl} qrSvg={qrSvg} />
    </div>
  );
}
