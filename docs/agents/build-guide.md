# Build guide for screen agents

Stack: Next.js 16 App Router, TypeScript, Tailwind 4, shadcn/ui on **Base UI** (triggers take `render={<Button/>}`, there is no `asChild`), Drizzle on Postgres, TanStack Table v8.

Read before writing: `src/server/schema.ts`, `src/server/access.ts`, `src/server/audit.ts`, `src/components/page.tsx`, `src/components/data-table.tsx`, `src/components/states.tsx`.
Copy the pattern in `src/app/(app)/students/`: `page.tsx` (server) calls `queries.ts`, renders a client table and an optional side panel chosen by a URL param; mutations live in `actions.ts`.

Rules
- Only edit files in the folders your task names. Never run git. Never touch `.env*`. Never restart or reset the database.
- Every server action starts with `requireAdmin()` or `requireViewer()`, validates input with zod, returns `{ error?: string }`, writes inside `db.transaction`, and calls `audit(tx, viewer, {...})` with old and new values. Then `revalidatePath`.
- Every query is scoped to `viewer.campusId` (join through `batch` to `programme.campusId`, or use `studentScope`). Faculty never get fee data.
- Pure rules are already in `src/domain/*`. Use them; don't re-implement them. Dates: `istDate()`. Money: integer paise, show with `rupees()`.
- All lists use `DataTable`. Pages start with `PageHeader`. Headline figures use `StatCard` in a `grid gap-3 sm:grid-cols-2 lg:grid-cols-4`. Groups use `SectionHeading`. States use `StatusPill` (always a word, never colour alone).
- Roll numbers and figures use `font-mono`. Use only theme colours (`primary`, `muted-foreground`, `absent`, `late`, `ok` and their `-soft`). No raw hex, no `gray-*`.
- Empty: `EmptyState` with one line plus the next action. Loading: the shared `(app)/loading.tsx` covers it. Errors from actions: `toast.error`. Keep typed input on failure.
- Must work at phone width. No dead buttons: anything shown must work. Glossary terms in `GLOSSARY.md`; say "Attendance session", never "sheet".
- Done means `pnpm typecheck` shows no errors in your files. Other agents are editing other folders, so ignore errors elsewhere. Don't run `pnpm build`.
- Final report: files written, what you didn't finish, in under 8 lines.
