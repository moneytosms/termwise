import type { Tone } from "@/components/page";
import type { MarksStatus } from "@/domain/marks";

export const STATUS: Record<MarksStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "default" },
  submitted: { label: "Submitted", tone: "late" },
  locked: { label: "Locked", tone: "ok" },
};
