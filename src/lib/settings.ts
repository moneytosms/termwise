"use client";

import { useSyncExternalStore } from "react";
import { PRESETS, SETTINGS_KEY } from "./settings-boot";

export { PRESETS };

// Preferences: cached in localStorage for instant paint, synced to the account by <SettingsSync>.
// `mode` mirrors next-themes (which applies it) so it syncs too.

export type Settings = {
  mode: "light" | "dark" | "system";
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
  mode: "light", preset: "default", reduceMotion: false, density: "comfortable", sidebarCollapsed: false,
  landing: "/home", pageSize: 20, confirmAttendance: true, shortcuts: true,
};

let cache: Settings | undefined;
const listeners = new Set<() => void>();
let onChange: ((s: Settings) => void) | undefined;

/** Registers the account saver; called on every user change, not on merges from the server. */
export function onSettingsChange(fn: (s: Settings) => void) {
  onChange = fn;
  return () => { if (onChange === fn) onChange = undefined; };
}

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

function store(next: Settings) {
  cache = next;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* private mode: keep for this tab only */ }
  applySettings(next);
  listeners.forEach((l) => l());
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  store({ ...readSettings(), [key]: value });
  onChange?.(cache!);
}

/** The account's saved settings win over this device's cache. */
export function mergeSettings(saved: Partial<Settings>) {
  store({ ...readSettings(), ...saved });
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, readSettings, () => DEFAULT_SETTINGS);
}

