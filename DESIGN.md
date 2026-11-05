---
name: Termwise
description: One college record, from admission to graduation.
colors:
  background: "#f2f4f7"
  foreground: "#0d0f12"
  card: "#ffffff"
  popover: "#ffffff"
  primary: "#15171a"
  primary-foreground: "#ffffff"
  secondary: "#e8eaee"
  muted: "#eef0f3"
  muted-foreground: "#5b616d"
  accent: "#eceef2"
  destructive: "#c4242a"
  border: "#e1e4e9"
  rule: "#eef0f3"
  input: "#d2d6dc"
  field: "#ffffff"
  ring: "#1d5fbf"
  data: "#1d5fbf"
  data-soft: "#e6eefa"
  absent: "#c4242a"
  absent-soft: "#ffedea"
  late: "#92400e"
  late-soft: "#fdf3dc"
  ok: "#247b50"
  ok-soft: "#dcf5e4"
  dark-background: "#0b0b0c"
  dark-card: "#141416"
  dark-foreground: "#f2f2f3"
  dark-data: "#6fa3f2"
typography:
  title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    letterSpacing: "-0.015em"
  figure:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 500
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  section:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
  body:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12px"
rounded:
  chip: "999px"
  sm: "4px"
  control: "6px"
  card: "8px"
  sheet: "12px"
spacing:
  gap: "12px"
  card-pad: "20px"
  rail: "15rem"
  content-max: "80rem"
  phone-margin: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.control}"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    border: "1px inset {colors.input}"
    rounded: "{rounded.control}"
    height: "36px"
  input:
    backgroundColor: "{colors.field}"
    border: "1px inset {colors.input}"
    rounded: "{rounded.control}"
    height: "36px"
  card:
    backgroundColor: "{colors.card}"
    border: "1px {colors.border}"
    rounded: "{rounded.card}"
  status-pill:
    rounded: "{rounded.chip}"
    height: "20px"
    typography: "{typography.label}"
---

# Design System: Termwise

## Overview

**The register.** Termwise is worked in all day by an office and on a phone between lectures, so the chrome holds no colour: a blue-grey desk (`background`), white sheets (`card`) edged by a 1px ring, ink text, a near-black primary. One data hue (`data`, #1d5fbf) marks the thing each screen is about: attendance against the line, today's bar, a changed mark. The other colours are states, always with a word: absent/overdue (red), late/to mark (amber), ok/paid (green).

Signature element: **the attendance line.** `AttendanceMeter` draws a thin track filled in the data hue with a tick at the programme's cutoff (75%); below the line the fill and figure turn red. It appears on Home, Students, the student panel and the parent page. `RegisterBar` (present/late/absent stacked) does the same for one session. The mark is a 3×3 register grid with one cell ticked in the data hue.

## Colors

- Chrome is neutral. The accent never fills nav, tabs or buttons.
- `data` only on data: the main series, the current period, a changed cell, focus rings.
- State pairs are pale tint plus dark ink of the same hue (`absent-soft`/`absent`, etc.).
- Dark theme is true neutral (#0b0b0c ground, #141416 sheets), primary inverted to white, data lifted to #6fa3f2.

## Typography

One face, Figtree, with tabular figures (`tabular-nums`) on every number. Scale: 24 title, 16 section, 28 figure, 14 body, 12 label. Sentence case everywhere; no tracked capitals. Monospace (`font-code`) only for audit JSON, action keys and entity ids.

## Layout

- Desktop: 15rem sidebar on the page ground (grouped nav, Ctrl K jump palette, user row at the foot), fluid canvas up to 80rem with 32-40px gutters, one 12px gap between blocks.
- Phone: 52px top bar (mark, page name, search), opaque bottom tab bar (faculty: four tabs; admin: four plus More, a bottom sheet holding every other area). 16px margins, 44px+ targets.
- Every screen: an h1 noun title, a grey line under it that states the finding ("16 classes not marked yet").

## Elevation & Depth

Surfaces are separated by a 1px ring (`shadow-sheet` = `0 0 0 1px border`) or a tone step, never both. Only floating things cast a shadow (`shadow-float`): menus, dialogs, sheets, the selection bar and the marks save bar. No gradients, glass or blur.

## Components

- **StatStrip / StatCard**: one sheet split by 1px seams; label over figure, no icons. Linked cells hover to a tint.
- **Panel / PanelLink**: card with a header row (title, lead figure, "View all").
- **DataTable**: search, filters (an active filter fills black), sortable columns, `meta.align: "right"` for figures, `meta.hidden` for identities folded into another cell (still exported), and a `mobile` renderer that replaces the table below 768px with two-line rows (identity and key figure on line 1, other fields on line 2). The phone list keeps table semantics.
- **StatusPill**: 20px pale pill, sentence case.
- **Initials**: a person's initials on a pale tint of a hue derived from their name.
- **Empty / error / loading**: dashed frame with one sentence and the next action; errors inline in the block; skeletons in the final layout.
- Showpieces only outside the app: an animated register on sign-in, a counting attendance figure on the parent page. Both are CSS or rAF, both still under reduced motion.

## Do's and Don'ts

Do: right-align figures, print zeros as zeros and missing values as a dash, put the screen's finding under its title, keep the faculty phone flow under 30 seconds.

Don't: tint nav or buttons with the data hue, add icons to KPIs, use uppercase labels, gradients, glows or blur, or add a second typeface.
