import { offlineDb, type TodayClass } from "./db";

/** Downloads today's classes. Returns false when it couldn't (offline), which leaves the last copy in place. */
export async function refreshToday(): Promise<"ok" | "offline" | "signed_out"> {
  let res: Response;
  try { res = await fetch("/api/today", { cache: "no-store" }); } catch { return "offline"; }
  if (res.status === 401) return "signed_out";
  if (!res.ok) return "offline";
  const { classes, date } = (await res.json()) as { classes: TodayClass[]; date: string };
  await offlineDb.transaction("rw", offlineDb.today, offlineDb.outbox, async () => {
    await offlineDb.today.clear();
    await offlineDb.today.bulkPut(classes);
    // Delivered items from earlier days are no longer needed.
    await offlineDb.outbox.filter((o) => o.state === "saved" && o.date !== date).delete();
  });
  return "ok";
}

export type FlushResult = "ok" | "offline" | "signed_out" | "nothing";
let flushing: Promise<FlushResult> | null = null;

/** Sends everything queued. Entries stay on the phone until the server answers for them. */
export function flushOutbox(): Promise<FlushResult> {
  flushing ??= doFlush().finally(() => { flushing = null; });
  return flushing;
}

async function doFlush(): Promise<FlushResult> {
  const rows = await offlineDb.outbox.where("state").anyOf("pending", "failed").toArray();
  if (!rows.length) return "nothing";
  let res: Response;
  try {
    res = await fetch("/api/sync", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientNow: new Date().toISOString(),
        items: rows.slice(0, 100).map((r) => ({ sessionId: r.sessionId, batchId: r.batchId, subjectId: r.subjectId, date: r.date, period: r.period, periodCount: r.periodCount, entries: r.entries, editedAt: r.editedAt, markedBy: r.markedBy })),
      }),
    });
  } catch { return "offline"; }
  if (res.status === 401) return "signed_out";
  if (!res.ok) {
    await offlineDb.outbox.bulkUpdate(rows.map((r) => ({ key: r.key, changes: { state: "failed" as const, error: "The server couldn't take this. It will retry." } })));
    return "offline";
  }
  const { results } = (await res.json()) as { results: { sessionId: string; outcome: "saved" | "stale" | "conflict" | "rejected"; error?: string }[] };
  await offlineDb.outbox.bulkUpdate(results.flatMap((r) => {
    const row = rows.find((x) => x.sessionId === r.sessionId);
    if (!row) return [];
    const state = r.outcome === "conflict" ? "conflict" as const : r.outcome === "rejected" ? "failed" as const : "saved" as const;
    return [{ key: row.key, changes: { state, error: r.error } }];
  }));
  return "ok";
}

/** Asks the service worker to deliver later (Android); iOS falls back to app open and reconnect. */
export async function requestBackgroundSync() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    await (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })?.sync?.register("attendance-outbox");
  } catch { /* unsupported: reconnect and app open still flush */ }
}
