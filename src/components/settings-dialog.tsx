"use client";

import { useTheme } from "next-themes";
import { SelectField } from "@/components/select-field";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PRESETS, setSetting, useSettings, type Settings } from "@/lib/settings";
import { cn } from "@/lib/utils";

// Swatches for the preset cards: background, text, accent, alert.
const SWATCHES: Record<Settings["preset"], string[]> = {
  default: ["#f2f4f7", "#0d0f12", "#1d5fbf", "#c4242a"],
  catppuccin: ["#eff1f5", "#4c4f69", "#8839ef", "#d20f39"],
  nord: ["#eceff4", "#2e3440", "#5e81ac", "#bf616a"],
  "tokyo-night": ["#e1e2e7", "#1a1b26", "#7aa2f7", "#f7768e"],
  "rose-pine": ["#faf4ed", "#575279", "#907aa9", "#b4637a"],
};

function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-muted p-[3px]">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn("h-7 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground", value === o.value && "bg-card text-foreground shadow-raised")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-input")}>
      <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-card shadow-raised transition-transform", checked && "translate-x-4")} />
    </button>
  );
}

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="pb-1 text-xs font-medium text-muted-foreground">{title}</h3>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

export function SettingsDialog({ open, onOpenChange, role, pages }: {
  open: boolean; onOpenChange: (o: boolean) => void; role: "faculty" | "office_admin"; pages: { href: string; label: string }[];
}) {
  const s = useSettings();
  const { theme, setTheme } = useTheme();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] gap-5 overflow-y-auto sm:max-w-lg">
        <div>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Saved on this device.</DialogDescription>
        </div>

        <Section title="Appearance">
          <Row title="Mode">
            <Segmented label="Mode" value={theme ?? "system"} onChange={setTheme}
              options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System" }]} />
          </Row>
          <div className="py-2.5">
            <p className="pb-2 text-sm font-medium">Preset</p>
            <div role="radiogroup" aria-label="Preset" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PRESETS.map((p) => {
                const on = s.preset === p.id;
                return (
                  <button key={p.id} role="radio" aria-checked={on} onClick={() => setSetting("preset", p.id)}
                    className={cn("flex flex-col items-start gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors hover:bg-muted", on ? "border-foreground" : "border-border")}>
                    <span className="flex gap-1">
                      {SWATCHES[p.id].map((c) => <span key={c} className="size-3.5 rounded-full border border-black/10" style={{ background: c }} />)}
                    </span>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <Row title="Reduce motion">
            <Switch label="Reduce motion" checked={s.reduceMotion} onChange={(v) => setSetting("reduceMotion", v)} />
          </Row>
          <Row title="Density">
            <Segmented label="Density" value={s.density} onChange={(v) => setSetting("density", v)}
              options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} />
          </Row>
        </Section>

        <Section title="Workflow">
          <Row title="Default page after sign-in">
            <SelectField aria-label="Default page after sign-in" value={s.landing} onValueChange={(v) => setSetting("landing", v)}
              options={pages.map((p) => ({ value: p.href, label: p.label }))} />
          </Row>
          <Row title="Rows per page">
            <SelectField aria-label="Rows per page" value={String(s.pageSize)} onValueChange={(v) => setSetting("pageSize", Number(v) as Settings["pageSize"])}
              options={[{ value: "10", label: "10" }, { value: "20", label: "20" }, { value: "50", label: "50" }]} />
          </Row>
          {role === "faculty" && (
            <Row title="Confirm before saving attendance">
              <Switch label="Confirm before saving attendance" checked={s.confirmAttendance} onChange={(v) => setSetting("confirmAttendance", v)} />
            </Row>
          )}
          <Row title="Keyboard shortcuts" hint="Ctrl K opens Go to. Ctrl B toggles the sidebar.">
            <Switch label="Keyboard shortcuts" checked={s.shortcuts} onChange={(v) => setSetting("shortcuts", v)} />
          </Row>
        </Section>
      </DialogContent>
    </Dialog>
  );
}
