"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, IndianRupee, LogOut, Moon, Palette, PanelLeft, Rows3, Search, Settings, ShieldAlert, ClipboardCheck, Sun, Users } from "lucide-react";
import { TermyIcon, type NavIcon } from "@/components/termy";
import type { ShellRole } from "@/components/app-shell";
import { useTheme } from "next-themes";
import { searchStudents } from "@/app/(app)/palette-actions";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PRESETS, setSetting, useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

type Nav = { href: string; label: string; icon: NavIcon };
type Mode = "go" | "actions" | "students" | "settings";
type Row = { key: string; label: string; icon?: NavIcon; hint?: string; run: () => void };
type Person = { id: number; rollNo: string; name: string; programme: string };

const MODES: [Mode, string][] = [["go", "Go to"], ["actions", "Actions"], ["students", "Students"], ["settings", "Settings"]];
const PLACEHOLDER: Record<Mode, string> = {
  go: "Go to a page", actions: "Run an action", students: "Find a student by name or roll number", settings: "Change a setting",
};
const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

/** Ctrl/Cmd+K palette. Prefix ">" jumps to Actions, "@" to Students. Tab cycles modes. */
export function CommandPalette({ open, onOpenChange, nav, role, onSettings, onSignOut }: {
  open: boolean; onOpenChange: (o: boolean) => void; nav: Nav[]; role: ShellRole;
  onSettings: () => void; onSignOut: () => void;
}) {
  const s = useSettings();
  useEffect(() => {
    if (!s.shortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); onOpenChange(!open); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.shortcuts, open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Body nav={nav} role={role} onSettings={onSettings} onSignOut={onSignOut} done={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

// Mounted only while open, so mode, query and results reset on each open.
function Body({ nav, role, onSettings, onSignOut, done }: {
  nav: Nav[]; role: ShellRole; onSettings: () => void; onSignOut: () => void; done: () => void;
}) {
  const router = useRouter();
  const s = useSettings();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mode, setMode] = useState<Mode>("go");
  const [q, setQ] = useState("");
  const [pick, setPick] = useState(0);
  const [people, setPeople] = useState<{ term: string; rows: Person[] }>({ term: "", rows: [] });

  const prefix = q.startsWith(">") ? "actions" : q.startsWith("@") && (role === "faculty" || role === "office_admin") ? "students" : null;
  const m = prefix ?? mode;
  const term = (prefix ? q.slice(1) : q).trim().toLowerCase();

  useEffect(() => {
    if (m !== "students" || !term) return;
    let live = true;
    const t = setTimeout(() => {
      searchStudents(term).then(
        (rows) => { if (live) setPeople({ term, rows }); },
        () => { if (live) setPeople({ term, rows: [] }); },
      );
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [m, term]);

  const run = (fn: () => void) => { done(); fn(); };
  const go = (href: string) => run(() => router.push(href));
  const current = (on: boolean) => (on ? "current" : undefined);

  const actions: Row[] = [
    ...(role === "faculty" ? [{ key: "mark", label: "Mark attendance", icon: ClipboardCheck, run: () => go("/mark") }] : []),
    ...(role === "office_admin" ? [
      { key: "fees", label: "Send fee reminders", icon: IndianRupee, run: () => go("/fees") },
      { key: "risk", label: "Run at-risk check", icon: ShieldAlert, run: () => go("/risk") },
    ] : []),
    { key: "theme", label: "Toggle dark mode", icon: Moon, run: () => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark")) },
    { key: "sidebar", label: "Toggle sidebar", icon: PanelLeft, run: () => run(() => setSetting("sidebarCollapsed", !s.sidebarCollapsed)) },
    { key: "settings", label: "Open settings", icon: Settings, run: () => run(onSettings) },
    { key: "signout", label: "Sign out", icon: LogOut, run: () => run(onSignOut) },
  ];
  const settingRows: Row[] = [
    ...(["light", "dark", "system"] as const).map((t) => ({ key: `mode-${t}`, label: `Mode: ${cap(t)}`, icon: Sun, hint: current(theme === t), run: () => run(() => setTheme(t)) })),
    ...PRESETS.map((p) => ({ key: `preset-${p.id}`, label: `Preset: ${p.label}`, icon: Palette, hint: current(s.preset === p.id), run: () => run(() => setSetting("preset", p.id)) })),
    ...(["comfortable", "compact"] as const).map((d) => ({ key: `density-${d}`, label: `Density: ${cap(d)}`, icon: Rows3, hint: current(s.density === d), run: () => run(() => setSetting("density", d)) })),
  ];
  const navRows: Row[] = nav.map((n) => ({ key: n.href, label: n.label, icon: n.icon, run: () => go(n.href) }));
  const personRows: Row[] = people.rows.map((p) => ({ key: String(p.id), label: p.name, icon: Users, hint: `${p.rollNo} · ${p.programme}`, run: () => go(`/students?student=${p.id}`) }));

  const byTerm = (rows: Row[]) => rows.filter((r) => r.label.toLowerCase().includes(term));
  // Anything typed in Go to or Actions can also be asked of Termy, last in the list.
  const raw = (prefix ? q.slice(1) : q).trim();
  const termy = nav.find((n) => n.label === "Termy")?.href;
  const askRow: Row[] = termy && (m === "go" || m === "actions") && raw.length >= 3
    ? [{ key: "ask", label: `Ask Termy: ${raw}`, icon: TermyIcon, run: () => go(`${termy}?q=${encodeURIComponent(raw)}`) }] : [];
  const rows = m === "go" ? [...byTerm(navRows), ...askRow] : m === "actions" ? [...byTerm(actions), ...askRow] : m === "settings" ? byTerm(settingRows) : people.term === term ? personRows : [];
  const searching = m === "students" && !!term && people.term !== term;
  const at = Math.min(pick, rows.length - 1);

  // Student search and Termy's staff page are staff-only.
  const staff = role === "faculty" || role === "office_admin";
  const modes = staff ? MODES : MODES.filter(([id]) => id !== "students");
  const cycle = () => { setMode(modes[(modes.findIndex(([id]) => id === mode) + 1) % modes.length][0]); setQ(""); setPick(0); };

  return (
    <>
      <div role="tablist" aria-label="Palette mode" className="flex gap-1 border-b border-border p-2">
        {modes.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={m === id} onClick={() => { setMode(id); setQ(""); setPick(0); }}
            className={cn("h-7 flex-1 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground", m === id && "bg-card text-foreground shadow-raised")}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2.5 border-b border-border px-4">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <input autoFocus value={q} placeholder={PLACEHOLDER[m]} aria-label={PLACEHOLDER[m]}
          onChange={(e) => { setQ(e.target.value); setPick(0); }}
          onKeyDown={(e) => {
            if (e.key === "Tab") { e.preventDefault(); cycle(); }
            if (e.key === "ArrowDown") { e.preventDefault(); setPick(Math.min(at + 1, rows.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setPick(Math.max(at - 1, 0)); }
            if (e.key === "Enter" && rows[at]) rows[at].run();
          }}
          className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm" />
      </div>
      <ul role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto p-1.5">
        {m === "students" && !term && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Type a name or roll number.</li>}
        {searching && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Searching…</li>}
        {!searching && rows.length === 0 && (m !== "students" || !!term) && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing called “{term}”.</li>}
        {rows.map((r, i) => (
          <li key={r.key} role="option" aria-selected={i === at}>
            <button onMouseEnter={() => setPick(i)} onClick={r.run}
              className={cn("flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-1.5 text-left text-sm", i === at && "bg-muted")}>
              {r.icon && <r.icon className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />}
              <span className="flex-1">{r.label}</span>
              {r.hint && <span className="text-xs text-muted-foreground">{r.hint}</span>}
              {i === at && <CornerDownLeft className="size-3.5 text-muted-foreground" aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        <span><kbd className="rounded bg-muted px-1.5 font-medium">↑↓</kbd> move</span>
        <span><kbd className="rounded bg-muted px-1.5 font-medium">↵</kbd> open</span>
        <span><kbd className="rounded bg-muted px-1.5 font-medium">Tab</kbd> mode</span>
        <span><kbd className="rounded bg-muted px-1.5 font-medium">&gt;</kbd> actions</span>
        <span><kbd className="rounded bg-muted px-1.5 font-medium">@</kbd> students</span>
        <kbd className="ml-auto rounded bg-muted px-1.5 font-medium">Ctrl K</kbd>
      </div>
    </>
  );
}
