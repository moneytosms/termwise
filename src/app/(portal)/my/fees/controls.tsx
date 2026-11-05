"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rupees } from "@/lib/utils";
import { payTestMode } from "./actions";

export function PayButton({ instalmentId, duePaise }: { instalmentId: number; duePaise: number }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const pay = () => start(async () => {
    const r = await payTestMode(instalmentId);
    if ("error" in r) toast.error(r.error);
    else router.push(`/my/fees/receipt/${r.paymentId}`);
  });
  return <Button className="mt-4 h-11 w-full" disabled={busy} onClick={pay}>Pay {rupees(duePaise)} (test mode)</Button>;
}

export function PrintButton() {
  return <Button variant="outline" onClick={() => window.print()}>Print</Button>;
}
