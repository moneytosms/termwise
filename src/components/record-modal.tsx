"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ChevronLeft, ChevronRight, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNeighbours } from "@/components/row-nav";
import { cn } from "@/lib/utils";

/**
 * One record from a list: centered on desktop, a bottom sheet on phones, background blurred.
 * `nav` steps through the list in the order the table shows it (← → keys too).
 * Always open while mounted; the page mounts it from a URL param and `onClose` drops the param.
 */
export function RecordModal({ title, description, leading, onClose, nav, footer, wide, children }: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Avatar or icon left of the title. */
  leading?: React.ReactNode;
  onClose: () => void;
  /** `key` matches the DataTable's `rowNav.key`; `href` builds the URL for another row's id. */
  nav?: { key: string; id: string; href: (id: string) => string };
  footer?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const n = useNeighbours(nav?.key ?? "", nav?.id ?? "");
  const go = (id: string | undefined) => { if (id && nav) router.replace(nav.href(id), { scroll: false }); };

  useEffect(() => {
    if (!n) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable], [role=listbox], [role=combobox]")) return;
      if (e.key === "ArrowLeft") go(n.prev);
      if (e.key === "ArrowRight") go(n.next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[rgb(var(--ink)/0.28)] backdrop-blur-[1.5px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          data-slot="record-modal"
          className={cn(
            "fixed z-50 flex flex-col bg-popover text-popover-foreground shadow-float outline-none transition duration-200 ease-out-quart",
            "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl data-ending-style:translate-y-8 data-starting-style:translate-y-8 data-ending-style:opacity-0 data-starting-style:opacity-0",
            "sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:max-h-[85dvh] sm:w-[min(36rem,calc(100%-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:data-ending-style:translate-y-[-50%] sm:data-starting-style:translate-y-[-50%] sm:data-ending-style:scale-95 sm:data-starting-style:scale-95",
            wide && "sm:w-[min(48rem,calc(100%-2rem))]",
          )}>
          <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />
          <header className="flex shrink-0 items-start gap-3 border-b border-rule px-5 pt-4 pb-4 sm:pt-5">
            {leading}
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="truncate text-lg leading-tight font-semibold tracking-tight">{title}</DialogPrimitive.Title>
              {description && <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>}
            </div>
            {n && n.total > 1 && (
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon-sm" aria-label="Previous" disabled={!n.prev} onClick={() => go(n.prev)}><ChevronLeft /></Button>
                <span className="min-w-12 text-center text-xs text-muted-foreground tabular-nums">{n.position} of {n.total}</span>
                <Button variant="ghost" size="icon-sm" aria-label="Next" disabled={!n.next} onClick={() => go(n.next)}><ChevronRight /></Button>
              </div>
            )}
            <DialogPrimitive.Close render={<Button variant="ghost" size="icon-sm" />}><XIcon /><span className="sr-only">Close</span></DialogPrimitive.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [overflow-wrap:anywhere]">{children}</div>
          {footer && <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-rule bg-muted/60 px-5 py-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:rounded-b-2xl">{footer}</footer>}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
