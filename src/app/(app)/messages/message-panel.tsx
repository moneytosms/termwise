"use client";

import { useRouter } from "next/navigation";
import { RecordModal } from "@/components/record-modal";
import { SectionHeading, StatusPill } from "@/components/page";
import type { MessageRow } from "./queries";

export function MessagePanel({ message: m }: { message: MessageRow }) {
  const router = useRouter();
  return (
    <RecordModal title={m.name} description={<><span className="tabular-nums">{m.rollNo}</span> · {m.kind} · {m.language}</>}
      nav={{ key: "messages", id: String(m.id), href: (id) => `/messages?message=${id}` }}
      onClose={() => router.push("/messages", { scroll: false })}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <StatusPill tone={m.status === "logged" ? "ok" : "absent"}>{m.status}</StatusPill>
          {m.language === "Odia" && <StatusPill tone="late">Needs native review</StatusPill>}
        </div>
        <SectionHeading title="Message" />
        <p className="whitespace-pre-wrap rounded-xl bg-muted/60 p-4 text-sm leading-relaxed">{m.body}</p>
      </div>
    </RecordModal>
  );
}
