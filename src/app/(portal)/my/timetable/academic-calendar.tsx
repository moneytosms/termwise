"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StatusPill, type Tone } from "@/components/page";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Kind = "holiday" | "exam" | "event";
export type CalendarEntry = { date: string; kind: Kind; label: string };

const KIND: Record<Kind, { tone: Tone; label: string; dot: string }> = {
  holiday: { tone: "ok", label: "Holiday", dot: "bg-ok" },
  exam: { tone: "late", label: "Exam", dot: "bg-late" },
  event: { tone: "default", label: "Event", dot: "bg-foreground/40" },
};
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Dates are "YYYY-MM-DD"; format in UTC so the calendar day never shifts.
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { ...o, timeZone: "UTC" });
const monthKey = (d: string) => d.slice(0, 7);
const monthTitle = (key: string) => fmt(`${key}-01`, { month: "long", year: "numeric" });
const addMonths = (key: string, n: number) => {
  const d = new Date(`${key}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};

/** The campus calendar as an upcoming list grouped by month, or a month grid. */
export function AcademicCalendar({ entries, today }: { entries: CalendarEntry[]; today: string }) {
  const [month, setMonth] = useState(monthKey(today));
  const upcoming = entries.filter((e) => e.date >= today);
  const byMonth = Map.groupBy(upcoming, (e) => monthKey(e.date));

  return (
    <Tabs defaultValue="list">
      <TabsList>
        <TabsTrigger value="list">Upcoming</TabsTrigger>
        <TabsTrigger value="month">Calendar</TabsTrigger>
      </TabsList>

      <TabsContent value="list" className="mt-2">
        {upcoming.length === 0 ? <EmptyState title="Nothing upcoming on the campus calendar." /> : (
          <div className="flex flex-col gap-6">
            {[...byMonth].map(([key, items]) => (
              <section key={key}>
                <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">{monthTitle(key)}</h3>
                <EntryList items={items} today={today} />
              </section>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="month" className="mt-2">
        <MonthGrid month={month} setMonth={setMonth} entries={entries} today={today} />
      </TabsContent>
    </Tabs>
  );
}

function EntryList({ items, today }: { items: CalendarEntry[]; today: string }) {
  return (
    <ul className="overflow-hidden rounded-xl bg-card shadow-sheet">
      {items.map((c, i) => (
        <li key={i} className="flex items-center gap-3 border-b border-rule px-4 py-3 last:border-0">
          <span className="w-24 shrink-0 text-sm text-muted-foreground tabular-nums">
            {c.date === today ? "Today" : fmt(c.date, { weekday: "short", day: "numeric", month: "short" })}
          </span>
          <span className="min-w-0 flex-1 truncate">{c.label}</span>
          <StatusPill tone={KIND[c.kind].tone}>{KIND[c.kind].label}</StatusPill>
        </li>
      ))}
    </ul>
  );
}

function MonthGrid({ month, setMonth, entries, today }: {
  month: string; setMonth: (m: string) => void; entries: CalendarEntry[]; today: string;
}) {
  const first = new Date(`${month}-01T00:00:00Z`);
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first offset
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const inMonth = entries.filter((e) => monthKey(e.date) === month);
  const on = Map.groupBy(inMonth, (e) => e.date);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-card p-3 shadow-sheet">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="flex-1 px-1 font-medium">{monthTitle(month)}</h3>
          {month !== monthKey(today) && (
            <Button variant="ghost" size="sm" onClick={() => setMonth(monthKey(today))}>Today</Button>
          )}
          <Button variant="ghost" size="icon-xs" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft /></Button>
          <Button variant="ghost" size="icon-xs" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight /></Button>
        </div>
        <div className="grid grid-cols-7 gap-px text-center text-xs text-muted-foreground">
          {WEEKDAYS.map((d) => <div key={d} className="pb-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            const items = d ? on.get(d) ?? [] : [];
            const holiday = items.some((e) => e.kind === "holiday");
            return (
              <div
                key={d ?? `pad-${i}`}
                title={items.map((e) => `${KIND[e.kind].label}: ${e.label}`).join("\n") || undefined}
                className={cn(
                  "flex min-h-12 flex-col gap-1 rounded-lg p-1 text-left md:min-h-20 md:p-1.5",
                  d && "bg-muted/40",
                  holiday && "bg-ok-soft",
                  d === today && "ring-2 ring-data",
                )}
              >
                {d && <span className={cn("text-xs tabular-nums", d === today ? "font-semibold text-data" : "text-muted-foreground")}>{Number(d.slice(8))}</span>}
                {/* Phone: dots. md+: labels. */}
                <div className="flex flex-wrap gap-0.5 md:hidden">
                  {items.map((e, j) => <span key={j} className={cn("size-1.5 rounded-full", KIND[e.kind].dot)} />)}
                </div>
                <div className="hidden flex-col gap-0.5 md:flex">
                  {items.map((e, j) => (
                    <span key={j} className="flex items-center gap-1 truncate text-xs">
                      <span className={cn("size-1.5 shrink-0 rounded-full", KIND[e.kind].dot)} />
                      <span className="truncate">{e.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {inMonth.length === 0
        ? <p className="px-1 text-sm text-muted-foreground">Nothing on the calendar in {monthTitle(month)}.</p>
        : <EntryList items={inMonth} today={today} />}
    </div>
  );
}
