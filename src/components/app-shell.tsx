"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpenCheck, CalendarDays, ClipboardCheck, CornerDownLeft, History, Home, IndianRupee, LogOut,
  Menu, MessageSquare, Moon, Search, Settings2, ShieldAlert, Sparkles, Sun, Users, type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { createAuthClient } from "better-auth/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Mark } from "@/components/mark";
import { cn } from "@/lib/utils";
import { clearOfflineData } from "@/offline/db";

type Item = { href: string; label: string; icon: LucideIcon; short?: string };
type Group = { label?: string; items: Item[] };

const FACULTY: Group[] = [{ items: [
  { href: "/home", label: "Home", icon: Home },
  { href: "/classes", label: "Classes", icon: CalendarDays },
  { href: "/marks", label: "Marks", icon: BookOpenCheck },
  { href: "/students", label: "Students", icon: Users },
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
    { href: "/assistant", label: "Assistant", icon: Sparkles },
  ] },
  { label: "Office", items: [
    { href: "/setup", label: "College setup", icon: Settings2, short: "Setup" },
    { href: "/audit", label: "Audit log", icon: History, short: "Audit" },
  ] },
];

const client = createAuthClient();

async function signOut() {
  await clearOfflineData();
  await client.signOut();
  window.location.href = "/sign-in";
}


export function AppShell({ role, name, campus, children }: {
  role: "faculty" | "office_admin"; name: string; campus: string; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const groups = role === "faculty" ? FACULTY : ADMIN;
  const all = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const { resolvedTheme, setTheme } = useTheme();
  const [more, setMore] = useState(false);
  const [jump, setJump] = useState(false);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState(0);
  // Phone tab bar: faculty get all four; admin gets the daily four plus a menu holding the rest.
  const tabs = role === "faculty" ? all : all.slice(0, 4);
  const current = all.find((i) => active(i.href));
  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  const actions = useMemo(() => [
    ...(role === "faculty" ? [{ href: "/mark", label: "Mark attendance", icon: ClipboardCheck }] : []),
    ...all,
  ], [all, role]);
  const hits = actions.filter((a) => a.label.toLowerCase().includes(q.trim().toLowerCase()));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setJump((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => { setJump(false); setQ(""); setPick(0); router.push(href); };

  const navLink = (on: boolean) => cn(
    "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-rail-hover hover:text-foreground",
    on && "bg-rail-active font-medium text-foreground hover:bg-rail-active");

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border/70 bg-rail px-3 py-4 md:flex">
        <div className="flex items-center gap-2.5 px-1.5 pb-4">
          <Mark />
          <div className="min-w-0">
            <p className="text-[0.95rem] leading-tight font-semibold tracking-tight">Termwise</p>
            <p className="truncate text-xs text-muted-foreground">{campus}</p>
          </div>
        </div>
        <button onClick={() => setJump(true)} className="mb-4 flex h-8 items-center gap-2 rounded-md bg-card px-2.5 text-sm text-muted-foreground shadow-raised transition-colors hover:text-foreground">
          <Search className="size-3.5" aria-hidden /><span className="flex-1 text-left">Go to…</span>
          <kbd className="rounded bg-muted px-1.5 text-[11px] font-medium">Ctrl K</kbd>
        </button>
        <nav className="flex-1 space-y-5 overflow-y-auto" aria-label="Main">
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.label && <p className="mb-1 px-2.5 text-xs text-muted-foreground">{g.label}</p>}
              <div className="space-y-0.5">
                {g.items.map((i) => (
                  <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined} className={navLink(active(i.href))}>
                    <i.icon className="size-4" strokeWidth={1.75} aria-hidden />{i.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="space-y-0.5 pt-3">
          <button onClick={toggleTheme} className={cn(navLink(false), "w-full")}>
            <Sun className="size-4 dark:hidden" strokeWidth={1.75} aria-hidden /><Moon className="hidden size-4 dark:block" strokeWidth={1.75} aria-hidden />
            <span className="dark:hidden">Dark theme</span><span className="hidden dark:inline">Light theme</span>
          </button>
          <div className="mt-2 flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">{name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium leading-tight">{name}</span>
              <span className="block text-xs text-muted-foreground">{role === "faculty" ? "Faculty" : "Office admin"}</span>
            </span>
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
          <button aria-label="Go to" className="grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-rail-hover" onClick={() => setJump(true)}>
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
            <button onClick={toggleTheme} aria-label="Switch theme" className="grid size-10 place-items-center rounded-md text-muted-foreground active:bg-muted">
              <Sun className="size-4.5 dark:hidden" aria-hidden /><Moon className="hidden size-4.5 dark:block" aria-hidden />
            </button>
            <button onClick={signOut} className="h-10 rounded-md px-3 text-sm font-medium active:bg-muted">Sign out</button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={jump} onOpenChange={(o) => { setJump(o); if (!o) { setQ(""); setPick(0); } }}>
        <DialogContent showCloseButton={false} className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogTitle className="sr-only">Go to</DialogTitle>
          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <input autoFocus value={q} placeholder="Go to a page or action" aria-label="Go to a page or action"
              onChange={(e) => { setQ(e.target.value); setPick(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setPick((p) => Math.min(p + 1, hits.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setPick((p) => Math.max(p - 1, 0)); }
                if (e.key === "Enter" && hits[pick]) go(hits[pick].href);
              }}
              className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm" />
          </div>
          <ul role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto p-1.5">
            {hits.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing called “{q}”.</li>}
            {hits.map((h, i) => (
              <li key={h.href + h.label} role="option" aria-selected={i === pick}>
                <button onMouseEnter={() => setPick(i)} onClick={() => go(h.href)}
                  className={cn("flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm", i === pick && "bg-muted")}>
                  <h.icon className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                  <span className="flex-1">{h.label}</span>
                  {i === pick && <CornerDownLeft className="size-3.5 text-muted-foreground" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
