"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheck, CalendarDays, ClipboardCheck, GraduationCap, History, Home, IndianRupee,
  MessageSquare, Moon, Settings2, ShieldAlert, Sparkles, Sun, Users, type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { createAuthClient } from "better-auth/react";
import { cn } from "@/lib/utils";
import { clearOfflineData } from "@/offline/db";

type Item = { href: string; label: string; icon: LucideIcon };

const FACULTY: Item[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/classes", label: "Classes", icon: CalendarDays },
  { href: "/marks", label: "Marks", icon: BookOpenCheck },
  { href: "/students", label: "Students", icon: Users },
];
const ADMIN: Item[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/students", label: "Students", icon: Users },
  { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/marks", label: "Marks", icon: BookOpenCheck },
  { href: "/fees", label: "Fees", icon: IndianRupee },
  { href: "/risk", label: "Risk", icon: ShieldAlert },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/assistant", label: "Assistant", icon: Sparkles },
  { href: "/setup", label: "College setup", icon: Settings2 },
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
  const items = role === "faculty" ? FACULTY : ADMIN;
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const { resolvedTheme, setTheme } = useTheme();
  // Phone bottom nav holds five at most; the rest stay reachable from the Home cards.
  const phone = role === "faculty" ? items : [items[0], items[1], items[2], items[3], items[8]];

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-card px-3 py-4 md:flex">
        <div className="flex items-center gap-2 px-3 pb-5">
          <GraduationCap className="size-5 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold leading-tight">Termwise</p>
            <p className="truncate text-xs text-muted-foreground">{campus}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5" aria-label="Main">
          {items.map((i) => (
            <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined}
              className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
                active(i.href) && "bg-accent font-medium text-accent-foreground")}>
              <i.icon className="size-4" aria-hidden />{i.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-0.5 border-t pt-3">
          {role === "office_admin" && (
            <Link href="/audit" aria-current={active("/audit") ? "page" : undefined}
              className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted", active("/audit") && "bg-accent text-accent-foreground")}>
              <History className="size-4" aria-hidden />Audit log
            </Link>
          )}
          <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
            <Sun className="size-4 dark:hidden" aria-hidden /><Moon className="hidden size-4 dark:block" aria-hidden />Switch theme
          </button>
          <div className="flex items-center justify-between gap-2 px-3 pt-2 text-sm">
            <span className="truncate">{name}</span>
            <button onClick={signOut} className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline">Sign out</button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 pb-20 md:pb-0">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <span className="font-semibold">Termwise</span>
          <span className="flex items-center gap-3">
            <button aria-label="Switch theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              <Sun className="size-4 dark:hidden" aria-hidden /><Moon className="hidden size-4 dark:block" aria-hidden />
            </button>
            <button onClick={signOut} className="text-xs text-muted-foreground">Sign out</button>
          </span>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-card md:hidden"
        style={{ gridTemplateColumns: `repeat(${phone.length}, 1fr)` }}>
        {phone.map((i) => (
          <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined}
            className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground", active(i.href) && "font-medium text-primary")}>
            <i.icon className="size-5" aria-hidden />{i.label.replace("College setup", "Setup")}
          </Link>
        ))}
      </nav>
    </div>
  );
}

