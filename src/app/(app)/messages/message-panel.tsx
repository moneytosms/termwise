"use client";

import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SectionHeading, StatusPill } from "@/components/page";
import type { MessageRow } from "./queries";

export function MessagePanel({ message: m }: { message: MessageRow }) {
  const router = useRouter();
  return (
    <Sheet open onOpenChange={(o) => { if (!o) router.push("/messages", { scroll: false }); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{m.name}</SheetTitle>
          <SheetDescription><span className="font-mono">{m.rollNo}</span> · {m.kind} · {m.language}</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-8">
          <StatusPill tone={m.status === "logged" ? "ok" : "absent"}>{m.status}</StatusPill>
          {m.language === "Odia" && <StatusPill tone="late">Needs native review</StatusPill>}
          <SectionHeading title="Message" />
          <p className="whitespace-pre-wrap text-sm">{m.body}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
