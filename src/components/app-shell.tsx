"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpenCheck, CalendarDays, ClipboardCheck, History, Home, IndianRupee, LogOut,
  Menu, MessageSquare, PanelLeft, Search, Settings, Settings2, ShieldAlert, Users,
} from "lucide-react";
import { createAuthClient } from "better-auth/react";
import { CommandPalette } from "@/components/command-palette";
import { SettingsDialog } from "@/components/settings-dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Mark } from "@/components/mark";
import { TermyIcon, type NavIcon } from "@/components/termy";
import { readSettings, setSetting, useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { clearOfflineData } from "@/offline/db";

type Item = { href: string; label: string; icon: NavIcon; short?: string };
type Group = { label?: string; items: Item[] };

const FACULTY: Group[] = [{ items: [
  { href: "/home", label: "Home", icon: Home },
  { href: "/classes", label: "Classes", icon: CalendarDays },
  { href: "/marks", label: "Marks", icon: BookOpenCheck },
  { href: "/students", label: "Students", icon: Users },
  { href: "/assistant", label: "Termy", icon: TermyIcon },
] }];
const ADMIN: Group[] = [
  { items: [
    { href: "/home", label: "Home", icon: Home },
    { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
    { href: "/students", label: "Students", icon: Users },
    { href: "/marks", label: "Marks", icon: BookOpenCheck },
    { href: "/fees", label: "Fees", icon: IndianRupee },
  ] },
  { label: "Follow-up", items: [
    { href: "/risk", label: "At-risk flags", icon: ShieldAlert, short: "Risk" },
    { href: "/messages", label: "Messages", icon: MessageSquare },
    { href: "/assistant", label: "Termy", icon: TermyIcon },
  ] },
  { label: "Office", items: [
    { href: "/setup", label: "College setup", icon: Settings2, short: "Setup" },
    { href: "/audit", label: "Audit log", icon: History, short: "Audit" },
  ] },
];

const client = createAuthClient();

const LANDED = "termwise:landed";

async function signOut() {
  try { sessionStorage.removeItem(LANDED); } catch { /* storage blocked */ }
  await clearOfflineData();
  await client.signOut();
  window.location.href = "/sign-in";
}


export function AppShell({ role, name, campus, children }: {
  role: "faculty" | "office_admin"; name: string; campus: string; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const s = useSettings();
  const groups = role === "faculty" ? FACULTY : ADMIN;
  const all = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const [more, setMore] = useState(false);
  const [palette, setPalette] = useState(false);
  const [settings, setSettings] = useState(false);
  // Phone tab bar: faculty get all four; admin gets the daily four plus a menu holding the rest.
  const tabs = role === "faculty" ? all : all.slice(0, 4);
  const current = all.find((i) => active(i.href));
  const collapsed = s.sidebarCollapsed;

  useEffect(() => {
    if (!s.shortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") { e.preventDefault(); setSetting("sidebarCollapsed", !collapsed); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.shortcuts, collapsed]);

  // Send a fresh sign-in to the chosen landing page once per tab. Mount only, reading storage directly:
  // the hook still returns defaults during hydration, and changing the setting later must not navigate.
  useEffect(() => {
    const landing = readSettings().landing;
    if (pathname !== "/home" || landing === "/home" || !all.some((i) => i.href === landing)) return;
    try {
      if (sessionStorage.getItem(LANDED)) return;
      sessionStorage.setItem(LANDED, "1");
    } catch { return; }
    router.replace(landing);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navLink = (on: boolean) => cn(
    "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-rail-hover hover:text-foreground",
    on && "bg-rail-active font-medium text-foreground hover:bg-rail-active", collapsed && "justify-center px-0");
  const hide = collapsed ? "sr-only" : undefined;

  return (
    <div className={cn("min-h-dvh transition-[grid-template-columns] duration-200 md:grid", collapsed ? "md:grid-cols-[4rem_1fr]" : "md:grid-cols-[15rem_1fr]")}>
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border/70 bg-rail px-3 py-4 md:flex">
        <div className={cn("flex items-center gap-2.5 pb-4", collapsed ? "flex-col" : "px-1.5")}>
          <Mark />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[0.95rem] leading-tight font-semibold tracking-tight">Termwise</p>
              <p className="truncate text-xs text-muted-foreground">{campus}</p>
            </div>
          )}
          <button onClick={() => setSetting("sidebarCollapsed", !collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-rail-hover hover:text-foreground">
            <PanelLeft className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <button onClick={() => setPalette(true)} title="Go to" aria-label="Go to"
          className={cn("mb-4 flex h-8 items-center gap-2 rounded-md bg-card px-2.5 text-sm text-muted-foreground shadow-raised transition-colors hover:text-foreground", collapsed && "justify-center px-0")}>
          <Search className="size-3.5" aria-hidden />
          {!collapsed && <>
            <span className="flex-1 text-left">Go to…</span>
            <kbd className="rounded bg-muted px-1.5 text-[11px] font-medium">Ctrl K</kbd>
          </>}
        </button>
        <nav className="flex-1 space-y-5 overflow-y-auto" aria-label="Main">
          {groups.map((g, gi) => (
            <div key={gi}>
              {collapsed && gi > 0 && <div className="mx-2 mb-2 border-t border-border/70" aria-hidden />}
              {g.label && !collapsed && <p className="mb-1 px-2.5 text-xs text-muted-foreground">{g.label}</p>}
              <div className="space-y-0.5">
                {g.items.map((i) => (
                  <Link key={i.href} href={i.href} title={collapsed ? i.label : undefined} aria-current={active(i.href) ? "page" : undefined} className={navLink(active(i.href))}>
                    <i.icon className="size-4" strokeWidth={1.75} aria-hidden /><span className={hide}>{i.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="space-y-0.5 pt-3">
          <button onClick={() => setSettings(true)} title="Settings" className={cn(navLink(false), "w-full")}>
            <Settings className="size-4" strokeWidth={1.75} aria-hidden /><span className={hide}>Settings</span>
          </button>
          <div className={cn("mt-2 flex items-center gap-2.5 rounded-md py-1.5", collapsed ? "flex-col" : "px-1.5")}>
            <span title={name} className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">{name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-tight">{name}</span>
                <span className="block text-xs text-muted-foreground">{role === "faculty" ? "Faculty" : "Office admin"}</span>
              </span>
            )}
            <button onClick={signOut} aria-label="Sign out" title="Sign out" className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-rail-hover hover:text-foreground">
              <LogOut className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="sticky top-0 z-30 flex h-13 items-center gap-2.5 border-b border-border/70 bg-background px-4 md:hidden">
          <Mark className="size-6" />
          <span className="flex-1 truncate text-[0.95rem] font-semibold tracking-tight">{current?.label ?? "Termwise"}</span>
          <button aria-label="Go to" className="grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-rail-hover" onClick={() => setPalette(true)}>
            <Search className="size-4.5" aria-hidden />
          </button>
          {role === "faculty" && (
            <button aria-label="Menu" className="grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-rail-hover" onClick={() => setMore(true)}>
              <Menu className="size-5" aria-hidden />
            </button>
          )}
        </header>
        <main className="mx-auto max-w-[80rem] px-4 py-5 md:px-8 md:py-8 lg:px-10">{children}</main>
      </div>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
        style={{ gridTemplateColumns: `repeat(${tabs.length + (role === "faculty" ? 0 : 1)}, 1fr)` }}>
        {tabs.map((i) => (
          <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined}
            className={cn("relative flex h-15 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground transition-colors active:bg-muted",
              active(i.href) && "font-medium text-foreground")}>
            {active(i.href) && <span className="absolute inset-x-5 top-0 h-0.5 rounded-b bg-foreground" aria-hidden />}
            <i.icon className="size-5" strokeWidth={active(i.href) ? 2 : 1.75} aria-hidden />{i.short ?? i.label}
          </Link>
        ))}
        {role === "office_admin" && (
          <button onClick={() => setMore(true)} aria-haspopup="dialog"
            className={cn("relative flex h-15 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground active:bg-muted",
              all.slice(4).some((i) => active(i.href)) && "font-medium text-foreground")}>
            {all.slice(4).some((i) => active(i.href)) && <span className="absolute inset-x-5 top-0 h-0.5 rounded-b bg-foreground" aria-hidden />}
            <Menu className="size-5" strokeWidth={1.75} aria-hidden />More
          </button>
        )}
      </nav>

      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="gap-0 px-3 pt-4 pb-3">
          <SheetTitle className="px-3 pb-2 text-base">{campus}</SheetTitle>
          <nav aria-label="All areas" className="grid grid-cols-2 gap-1 overflow-y-auto">
            {(role === "faculty" ? [] : all.slice(4)).map((i) => (
              <Link key={i.href} href={i.href} onClick={() => setMore(false)} aria-current={active(i.href) ? "page" : undefined}
                className={cn("flex h-12 items-center gap-3 rounded-lg px-3 text-sm active:bg-muted", active(i.href) && "bg-muted font-medium")}>
                <i.icon className="size-4.5 text-muted-foreground" strokeWidth={1.75} aria-hidden />{i.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center gap-2 border-t border-border px-3 pt-3">
            <span className="min-w-0 flex-1 truncate text-sm"><span className="font-medium">{name}</span> <span className="text-muted-foreground">· {role === "faculty" ? "Faculty" : "Office admin"}</span></span>
            <button onClick={() => { setMore(false); setSettings(true); }} className="h-10 rounded-md px-3 text-sm font-medium text-muted-foreground active:bg-muted">Settings</button>
            <button onClick={signOut} className="h-10 rounded-md px-3 text-sm font-medium active:bg-muted">Sign out</button>
          </div>
        </SheetContent>
      </Sheet>

      <CommandPalette open={palette} onOpenChange={setPalette} nav={all} role={role}
        onSettings={() => setSettings(true)} onSignOut={signOut} />
      <SettingsDialog open={settings} onOpenChange={setSettings} role={role} pages={all} />
    </div>
  );
}
