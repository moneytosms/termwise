"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { saveSettings } from "@/app/(app)/settings-actions";
import { mergeSettings, onSettingsChange, readSettings, setSetting, type Settings } from "@/lib/settings";

/** Pulls the account's settings into this device on load and pushes later changes back (debounced). */
export function SettingsSync({ saved }: { saved: Partial<Settings> | null }) {
  const { theme, setTheme } = useTheme();
  const mounted = useRef(false);

  useEffect(() => {
    if (saved) {
      mergeSettings(saved);
      if (saved.mode) setTheme(saved.mode);
    } else {
      void saveSettings(readSettings()); // first sign-in with sync: keep what this device had
    }
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = onSettingsChange((s) => { clearTimeout(t); t = setTimeout(() => void saveSettings(s), 600); });
    return () => { clearTimeout(t); off(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // next-themes owns the mode; mirror user changes into settings. Skip the first run so the
  // device's old mode doesn't overwrite the account's before setTheme(saved.mode) lands.
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (theme && theme !== readSettings().mode) setSetting("mode", theme as Settings["mode"]);
  }, [theme]);

  return null;
}
