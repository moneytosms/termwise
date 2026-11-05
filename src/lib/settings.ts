"use client";

import { useSyncExternalStore } from "react";
import { SETTINGS_KEY } from "./settings-boot";

// Per-device preferences. Light/dark/system lives in next-themes; everything else here.
export const PRESETS = [
  { id: "default", label: "Register" },
  { id: "catppuccin", label: "Catppuccin" },
  { id: "nord", label: "Nord" },
  { id: "tokyo-night", label: "Tokyo Night" },
  { id: "rose-pine", label: "Rosé Pine" },
] as const;

export type Settings = {
  preset: (typeof PRESETS)[number]["id"];
  reduceMotion: boolean;
  density: "comfortable" | "compact";
  sidebarCollapsed: boolean;
  /** Page to open after sign-in, instead of Home. */
  landing: string;
  pageSize: 10 | 20 | 50;
  confirmAttendance: boolean;
  shortcuts: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  preset: "default", reduceMotion: false, density: "comfortable", sidebarCollapsed: false,
  landing: "/home", pageSize: 20, confirmAttendance: true, shortcuts: true,
};

let cache: Settings | undefined;
const listeners = new Set<() => void>();

export function readSettings(): Settings {
  if (cache) return cache;
  try { cache = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") }; }
  catch { cache = DEFAULT_SETTINGS; }
  return cache!;
}

/** Mirrors the visual settings onto <html> as data attributes the CSS keys off. */
export function applySettings(s: Settings) {
  const d = document.documentElement.dataset;
  d.preset = s.preset;
  d.density = s.density;
  d.motion = s.reduceMotion ? "reduce" : "full";
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  cache = { ...readSettings(), [key]: value };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(cache)); } catch { /* private mode: keep for this tab only */ }
  applySettings(cache);
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, readSettings, () => DEFAULT_SETTINGS);
}

