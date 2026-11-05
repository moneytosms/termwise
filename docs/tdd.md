# Termwise: Technical Design Document

**Repository:** https://github.com/moneytosms/termwise
**Live app:** _added once deployed_
**Demo logins:** see `deployment.md` (password `termwise-demo` for every account)

Termwise is the first phase of a college ERP for Company A's trust, built for the core slice the brief asks for: one campus, college setup for one programme, mobile attendance that works offline, internal marks with a moderation lock, fee dues, two roles (faculty and office admin) and an at-risk flag. Assumptions are marked **[A]** and listed together in section 9.

## 1. What the slice proves

The brief's hard part is attendance taken on a phone in a classroom with weak Wi-Fi. The design starts there, and everything else is built so that one record per student flows into marks, dues, risk and messages without re-entry.

| Brief success measure | How the slice serves it |
| --- | --- |
| Attendance entered the same day for 95% of classes | Home opens on today's classes; marking a class is one tap per absentee and works with no network |
| University mark uploads with no re-typing | Marks are entered once per component, locked after moderation, exported in an upload CSV |
| Fee reconciliation from 10 days to 1 | Dues are calculated from instalments and payments, never typed; receipts export as Tally vouchers |

## 2. Architecture

```
Phone / browser ── Next.js 16 app (React server components, server actions, route handlers)
   │  service worker + IndexedDB outbox          │
   │                                             ├── Postgres 18 (app role: read/write)
   └── /api/today, /api/sync ────────────────────┤
                                                 ├── Postgres views (assistant role: read-only, self-filtering)
                                                 └── LLM (Gemini or Groq), capped per day, optional
Daily job: GitHub Actions schedule → POST /api/cron/daily (shared secret)
```

**One deployable.** A single Next.js app with its database, in one Docker image. Server components read the database directly; mutations are server actions that check the viewer's role and campus, validate with zod and write an audit row in the same transaction. For a 6 to 8 screen slice built by one person in a week, a separate API service would add a contract to maintain and nothing the client can see. Route handlers exist only where a non-page client needs them: the offline sync endpoint, CSV and Tally downloads, and the daily job.

**Why these parts**

- **Next.js and React** for one language across screens and server, and server components that keep student data on the server unless a screen needs it.
- **Postgres** because the domain is relational (student, batch, subject, session, entry) and because two database features carry the AI guardrails: views and roles.
- **Drizzle** for typed queries that stay close to SQL, so the attendance and dues arithmetic is readable.
- **Better Auth** with email and password. Campus roles live on a `staff` row linked to the user, so access checks are one join, not an organisation plugin.
- **Dexie (IndexedDB) and a hand-written service worker** for offline. A plugin-generated worker could not reliably serve the app's dynamic pages offline on Next 16, so the worker is about 70 lines that precache exactly three screens and their assets.
- **Vercel AI SDK** with a structured output schema, so the LLM returns a plan object, never free text that is executed.

**Access control.** Every query on a screen goes through `getViewer()`, which resolves the signed-in user to a staff row with a role and a campus. Office admins see their campus; faculty see the subjects they teach and the students they mentor. Faculty visiting an admin screen are sent to Home. The assistant, Termy, runs as a separate database role that can only read views filtered by campus, role and teacher.

## 3. Data model

```
campus ─┬─ department ─ programme ─ batch ─┬─ student ─┬─ attendance_entry ── attendance_session
        │                                  │            ├─ mark ── mark_component ── subject
        ├─ staff (role, campus) ── user     ├─ subject   ├─ fee_instalment ── fee_payment
        ├─ calendar_day                     └─ timetable_slot
        └─ audit_log, job_run               risk_flag ── mentor_task, message, sync_conflict
```

Choices that matter:

- **A student exists once.** Roll number is unique across the trust. Attendance, marks, dues, flags and messages all hang off `student.id`.
- **Attendance session, not attendance sheet.** One row per batch, subject, date and period, with a client-generated UUID so the phone can create it offline. A lab is one session covering several periods (`period_count`); percentages are weighted by periods. Late counts as attended **[A]**.
- **Dues are calculated, never stored.** Due = instalment amount − scholarship − payments. Overdue = due on instalments past their due date. No balance column can drift from the payments.
- **Marks scheme by section.** Each subject is theory or lab and has a maximum per section. Faculty define the internal components, which must total the internal maximum of 40 (the demo uses Internal test 20, Assignment 10, Quiz 5, Attendance 5 **[A]**). Mid-term exam (20) and end-term exam (40) are one component each; a lab adds lab exam (15), viva (10) and continuous evaluation (5) **[A]**. Internal marks are the internal section alone. The final score is out of 100: theory (internal, mid, end) scaled by the theory scale (100 for theory, 70 for labs), plus the lab sections. See `adr/0001-marks-scheme-internal-40.md`. A subject's marks move draft → submitted → locked. A locked subject rejects edits at the server; reopening needs a reason, and every change is in the audit log.
- **Appeals.** A student (not a parent) appeals one mark or one absent or late entry, with a reason of 10 to 500 characters. One open appeal per item. An accepted appeal can change a locked mark; it is audited with the appeal id.
- **College profile.** Legal name, tagline, affiliation, registration number, GSTIN, address, contact, logo (data URL, 200 KB at most) and receipt footer sit on the campus row. Receipts read them.
- **Rules are settings, not AI.** Attendance cutoff (75% default per programme), risk thresholds (attendance drop of 10 points in 4 weeks, internal marks below 50% of the maximum of the internal components entered, at least 10 sessions held **[A]**) live on the campus and programme rows and are edited in College setup.
- **Audit log** records actor, action, entity, old and new value and reason, written in the same transaction as the change.

## 4. Main flows

### 4.1 Offline attendance with sync (the hard part)

1. When a teacher opens the app with any connection, `/api/today` returns today's classes with rosters (roll numbers and names only) and the phone stores them in IndexedDB. The service worker caches Home, Classes and Mark attendance.
2. In class, with no network, the teacher opens the class. Everyone starts present; one tap marks absent, a second tap late, a third tap present again. A search box jumps to a roll number. Save writes the sheet to an outbox in IndexedDB and returns to Home, where the class shows as queued.
3. The outbox flushes when the app opens, when the network returns and through Background Sync on Android. The server answers each item separately: saved, stale (an older edit), conflict or rejected, so one bad item never blocks the rest.
4. **Conflicts.** If another teacher already saved the same class, the incoming sheet goes to a conflict queue for the office admin instead of overwriting it. Last-edit-wins only applies to the same teacher's own edits. Edit times are corrected for a wrong phone clock using the gap between the phone's and the server's time at send.
5. **Shared phones.** Each queued sheet carries the id of the teacher who marked it. If a different teacher is signed in when it sends, the server rejects it and the sheet stays on the phone until the right teacher signs in.
6. Signing out clears everything about students from the phone.

### 4.2 Marks and moderation

Faculty enter marks per component on one sheet per subject, with each cell checked against the component's maximum, then save as draft and submit. The office admin locks a submitted subject; the lock is enforced in the server action, not just hidden in the UI. Reopen needs a typed reason. The locked sheet exports as CSV in an assumed university upload layout: `RollNo, Name, SubjectCode`, one column per internal component, `InternalTotal` (internal section only) **[A]**.

### 4.3 Fees

Instalments per student (the seed uses two per year with some scholarships) produce dues and overdue amounts. The office admin records bank counter payments against an instalment; a payment over the remaining due or of zero is refused. Fee reminders go to students with dues. Receipts for a date range download as Tally receipt vouchers in XML **[A: format based on Tally ERP 9 import samples, not confirmed against TallyPrime]**.

Each payment also has an official receipt on the college profile letterhead, with the amount in words (Indian numbering), a verification hash (HMAC-SHA256 over the receipt's fixed fields, keyed by `BETTER_AUTH_SECRET`) and a QR code. The public `/verify/receipt/<id>?h=<hash>` page shows whether the receipt is valid, with the student's name masked to first name and last initial.

### 4.4 Student and parent portal (Tier 2)

Students and parents sign in like staff and get the same sidebar layout with their own menu. A student sees today's classes as a carousel that opens on the current or next class, and the week's timetable, attendance per subject with a planner ("attend the next N in a row to reach 75%" or "you can miss N"), a day-by-day register with search, status and date-range filters, marks by component with the final score and a printable mark sheet once moderation locks them, fees with a test-mode Pay button and receipts, leave requests, their profile with the admission document checklist, and Termy scoped to their own rows. A parent sees the same for each linked child (switcher in the sidebar), approves the child's leave before the mentor does, reads the college's messages in English or Odia, writes to the mentor, and gives or withdraws DPDP consent for a minor. Every portal query uses the signed-in student, or a child linked to the signed-in parent; no student id is taken from the browser. Mentors decide leave and answer parent notes, and the office answers record corrections, on a Requests page. Approved leave is shown on the register but still counts as absent. Subject faculty (their own subjects) or the office admin decide an appeal once, under Requests > Appeals: accept with the corrected mark or status, or reject with a response. The decision is final. Long lists are paged with `?page=`: register 30 rows, leave 10, messages 15, payments 10.

### 4.5 Messages and consent

Messages are logged, not sent **[A: no SMS or WhatsApp gateway in scope]**, in English and Odia. A student under 18 with no recorded parental consent gets no message; the attempt is logged as blocked, following the DPDP Act's rule for minors. The Odia templates need review by a native speaker before real use.

## 5. How the AI part works

### 5.1 At-risk flag

A daily job (and a Run now button) checks every student against the fixed rules: attendance below the cutoff in any subject, attendance dropping by the configured points over 4 weeks, or internal marks below the configured percentage of the maximum of the internal components entered so far. **The rule decides; the LLM never does.** When a student is flagged, the LLM may reword the rule's reason into one plain sentence for the mentor. If the LLM fails, times out or the daily cap is used, the rule's own wording is kept and marked as such. A flag only creates a mentor task; it changes no record and sends nothing to the student. A student with too little data (fewer than the minimum sessions, or no marks entered) is reported as not enough data, not as clear.

### 5.2 Plain-English questions

Office staff ask questions such as "how many second-year students are below 75% this month".

1. The LLM receives the question and a description of six campus-filtered views, and must return a structured plan: query, clarify or refuse, the SQL, the filters in plain English, and a one-sentence summary.
2. The SQL is parsed with the Postgres parser (libpg-query) and checked against an allowlist: one SELECT, only the six views, no functions outside a safe list, no writes, no comments or multiple statements.
3. It runs as the `termwise_assistant` role, which can read only those views, inside a read-only transaction with a statement timeout and a row limit. The views filter themselves by the campus, role and staff id set for that transaction: admins see their campus, faculty see only the subjects they teach and those batches' students, and never fees. Even a query that passes validation cannot widen that, and an unset role makes the views error rather than show everything.
4. **When it is wrong or unsure:** the answer always shows the filters it used, the row count and the SQL, so staff can see what was counted. An unclear question gets a clarifying question back. A request to change data is refused. Invalid SQL is rejected with a plain message. With no provider or a spent daily cap, the screen says so and points to the normal lists.

## 6. UI and design decisions

The brief asks for calm, minimal screens used all day, one layout pattern across modules and attendance in under 30 seconds per class.

- **One layout.** Every admin screen is a page header, a short row of counts, and one table with search and filters; selecting a row opens a side panel rather than a new page. Faculty get a bottom tab bar on the phone with four items.
- **Restrained palette.** One accent (a petrol blue-green) on neutral greys, in light and dark. Colour carries meaning only for status: present, absent, late, shortage and overdue.
- **Type.** Figtree for text, IBM Plex Mono for roll numbers, percentages and money, so figures line up in tables.
- **Mark attendance.** Built for one thumb: large rows, everyone present by default, a running present and absent count on the Submit button, and a confirm sheet that lists the absent and late names before saving. A class of 60 with five absentees takes five taps, Submit and Confirm.
- **States.** Every list has a loading skeleton, an empty state that says what to do next, and an error state with retry. Offline screens say what is queued and what needs a connection.
- **Key screens:** faculty Home (today's classes and queued sheets), Mark attendance, Marks sheet; admin Home (campus counts and to-dos), Attendance (sessions and conflict queue), Marks (subjects by status, lock and reopen), Fees (dues, payments, reminders, Tally export), Risk (flags and mentor tasks), Requests (leave, parent notes and appeals), Termy (the assistant, for admin and faculty), College setup (subjects with their marks schemes, college profile), Audit log.

## 7. Testing and security

- **Unit tests (Vitest)** cover attendance percentages with labs and late, sync decisions and clock correction, marks validation and the lock, dues and payment validation, risk rules, the assistant SQL validator against injection attempts and per-role view lists, the assistant views' role scoping against a seeded database, Tally XML, the attendance planner, the marks scheme and final score, appeal rules, and amount in words with the receipt hash.
- **End-to-end tests (Playwright, phone viewport)** cover offline marking then sync, the conflict queue, the shared-phone rejection, the marks lock and audited reopen, campus and role limits, fee payments and reminders, the at-risk run, the assistant with no provider, College setup edits, attendance correction, and the student and parent portal (role pages, child switch, leave from student to parent to mentor, appeals raised and decided).
- **CI** runs all of it on every push against a fresh Postgres.
- **Security:** no secrets in the repository (only local-only defaults); every input validated with zod at the server; role and campus checked on every query and action; audit log on every change; auth rate-limited; the assistant on a read-only role; students and parents sign in and every portal query is pinned to their own (or their linked children's) record; offline data limited to names and roll numbers and cleared on sign-out. The public verify page shows only the receipt number, date, amount and a masked student name.

## 8. What was cut, and what comes next

**Cut from this phase:** the other two campuses' setup (the data model is multi-campus and a second campus is seeded to prove isolation), applicant import and roll number generation, staff leave, the trust dashboard, mark sheet PDFs, NAAC and AICTE report formats, real SMS or WhatsApp, a real payment gateway, electives and class sections, timetable generation.

**Next, in order:**

1. Applicant import with document checklist and roll numbers, so a student is created once at admission.
2. Results day: 7,800 students reading at once. Serve results from a precomputed table and a CDN-cached page per student, so the database sees one write per student rather than thousands of reads.
3. Trust dashboard across the three campuses, and staff leave.
4. University, AICTE and NAAC reports as saved queries over the same views the assistant uses.
5. Rollout: one programme per campus first, then each campus, training one teacher per department as the first line of support.

## 9. Assumptions

Each is a choice the brief does not settle.

1. Late counts as attended for the percentage.
2. A lab is one session covering consecutive periods, weighted by periods.
3. Internal marks out of 40 are faculty-defined components; the demo uses Internal test 20, Assignment 10, Quiz 5 and Attendance 5. Theory is internal 40, mid-term exam 20 and end-term exam 40 (100 in all). A lab scales that theory to 70 and adds lab exam 15, viva 10 and continuous evaluation 5 (see ADR 0001).
4. University upload columns: `RollNo, Name, SubjectCode`, one column per internal component, `InternalTotal`.
5. Risk thresholds: below the cutoff in any subject, a 10-point drop over 4 weeks, internal marks under 50% of the maximum of the internal components entered, at least 10 sessions before judging.
6. Fees in two instalments per year; scholarships reduce an instalment.
7. Tally receipt voucher XML follows ERP 9 import samples.
8. Messages are logged, not sent; parental consent is a recorded date on the student.
9. The demo timetable includes Sunday so a class is always available to mark on the demo day.
10. Faculty see only the subjects they teach and the students they mentor.
11. The sample data is synthetic; the brief's three students appear with their exact figures.
12. Only students (not parents) can appeal; one open appeal per item, with a reason of 10 to 500 characters; a decision is final.
13. Receipt hashes are keyed by `BETTER_AUTH_SECRET`; rotating that secret makes issued receipts fail verification.
