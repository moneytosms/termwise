import Dexie, { type EntityTable } from "dexie";
import type { OutboxItem } from "@/domain/sync";

export type RosterStudent = { id: number; rollNo: string; name: string };
/** One class today for this teacher. Holds only roll numbers and names, per the offline data rule. */
export type TodayClass = {
  key: string; // batchId:subjectId:date:period
  batchId: number;
  batchCode: string;
  subjectId: number;
  subjectName: string;
  date: string;
  period: number;
  periodCount: number;
  startTime: string;
  endTime: string;
  sessionId: string | null; // set when already saved on the server
  roster: RosterStudent[];
};
export type OutboxRow = OutboxItem & { key: string; state: "pending" | "failed" | "saved" | "conflict"; error?: string };

export const offlineDb = new Dexie("termwise") as Dexie & {
  today: EntityTable<TodayClass, "key">;
  outbox: EntityTable<OutboxRow, "key">;
};
offlineDb.version(1).stores({ today: "key, date", outbox: "key, state" });

/** Logout rule: nothing about students stays on the phone. */
export async function clearOfflineData() {
  await Promise.all([offlineDb.today.clear(), offlineDb.outbox.clear()]);
  (await navigator.serviceWorker?.getRegistration())?.active?.postMessage("clear");
}
