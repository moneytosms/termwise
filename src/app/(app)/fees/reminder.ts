import { rupees } from "@/lib/utils";

/** Under 18 on `today` (both YYYY-MM-DD, IST). */
export const isMinor = (birthDate: string, today: string) => birthDate > `${Number(today.slice(0, 4)) - 18}${today.slice(4)}`;

export const reminderBody = (name: string, rollNo: string, duePaise: number) =>
  `Fee reminder for ${name} (${rollNo}): ${rupees(duePaise)} is due. Please pay at the bank counter.`;
