"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { offlineDb } from "./db";
import { flushOutbox, refreshToday } from "./sync";

export type SyncState = { pending: number; failed: number; conflict: number; online: boolean; signedOut: boolean; retry: () => void };

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
}

/** Keeps today's rosters fresh and the outbox moving while the app is open. */
export function useSync(): SyncState {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [signedOut, setSignedOut] = useState(false);
  const counts = useLiveQuery(async () => {
    const rows = await offlineDb.outbox.toArray();
    return {
      pending: rows.filter((r) => r.state === "pending").length,
      failed: rows.filter((r) => r.state === "failed").length,
      conflict: rows.filter((r) => r.state === "conflict").length,
    };
  }, [], { pending: 0, failed: 0, conflict: 0 });

  const retry = useCallback(async () => {
    const flush = await flushOutbox();
    const today = await refreshToday();
    setSignedOut(flush === "signed_out" || today === "signed_out");
  }, []);

  useEffect(() => {
    const on = () => void retry();
    window.addEventListener("online", on);
    const first = setTimeout(retry);
    const timer = setInterval(() => { if (navigator.onLine) void flushOutbox(); }, 30_000);
    return () => { window.removeEventListener("online", on); clearTimeout(first); clearInterval(timer); };
  }, [retry]);

  return { ...counts, online, signedOut, retry };
}
