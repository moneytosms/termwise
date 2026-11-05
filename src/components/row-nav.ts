"use client";

import { useSyncExternalStore } from "react";

// The order a list currently shows (after search, filters and sort), so a record modal can step to the next row.
const orders = new Map<string, string[]>();
const listeners = new Set<() => void>();

export function setRowOrder(key: string, ids: string[]) {
  const old = orders.get(key);
  if (old && old.length === ids.length && old.every((id, i) => id === ids[i])) return;
  orders.set(key, ids);
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useNeighbours(key: string, id: string) {
  const ids = useSyncExternalStore(subscribe, () => orders.get(key), () => undefined);
  const i = ids?.indexOf(id) ?? -1;
  if (!ids || i < 0) return null;
  return { prev: ids[i - 1], next: ids[i + 1], position: i + 1, total: ids.length };
}
