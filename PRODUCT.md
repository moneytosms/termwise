# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Faculty (primary).** Teachers on their phones, in classrooms with weak or no Wi-Fi, marking period-wise attendance between lectures and entering internal marks once per component. When design trade-offs conflict, the faculty phone flow wins.
- **Office admin.** Campus office staff at a desk all day: college setup, attendance sessions and conflict queue, marks moderation lock, fee dues and payments, at-risk flags, plain-English assistant, audit log.
- **Parents.** Open a signed, time-limited link from a shortage alert or fee reminder on a phone: read-only attendance by subject and dues, test-mode payment, printable receipt. No accounts this phase.
- **Trust Secretary.** Signs the deal; judges value through dashboards and reports (mostly cut this phase).
- **Assignment reviewers.** Evaluate the build by 2026-11-09 against "a UI that feels designed, not default", a phone-ready layout, and loading, empty and error states. They try it through demo logins.

## Product Purpose

Termwise is the first phase of a college ERP for an educational trust running three campuses (Company A, Bhubaneswar). One system where a student exists once, from admission to graduation. This slice covers one campus: college setup for one programme, offline mobile attendance with sync, internal marks with a moderation lock, fee dues, two roles (faculty, office admin), and an at-risk flag.

Success (from the brief): attendance entered the same day for 95% of classes; university mark uploads with no re-typing; monthly fee reconciliation from 10 days to 1.

## Positioning

Attendance is taken in class on a phone with no network and syncs later without overwriting another teacher's sheet; one student record flows into marks, dues, risk and messages with no re-entry. AI only words and asks: rules decide risk, and the assistant shows its filters, row count and SQL, runs read-only on views the role may see, and cannot change records.

## Operating Context

- Classrooms have weak Wi-Fi; the phone must work offline for Home, Classes and Mark attendance.
- Attendance target: under 30 seconds per class. Everyone starts present; one tap per absentee.
- Admin work is all-day table work: search, filter, select a row, act in a side panel.
- Today the trust runs on paper, Excel, a 12-year-old desktop program, bank-counter fees and hand matching in Tally.
- Outputs leave the system as university upload CSV and Tally receipt voucher XML.

## Capabilities and Constraints

- Terminology is fixed by `GLOSSARY.md`: Subject, Batch, Attendance session, Attendance shortage, Moderation lock, At-risk flag, Mentor task, College setup. Use these words in UI copy.
- Access is limited by campus and role; faculty see only subjects they teach and students they mentor.
- Marks move draft, submitted, locked; reopen needs a typed reason; every change is audited.
- Attendance and risk rules are fixed settings edited in College setup, not AI.
- DPDP Act 2023: minors without recorded parental consent get no messages; offline data is limited to names and roll numbers and cleared on sign-out.
- Messages are logged, not sent, in English and Odia (Odia templates need native review). UI is English.
- Payments are test mode only. No real SMS, WhatsApp or gateway.
- Cut this phase: other campuses' setup, admissions import, staff leave, trust dashboard, mark sheet PDFs, NAAC/AICTE reports, student and parent accounts.

## Brand Commitments

- Name: **Termwise**.
- Client's stated design values (binding): good, minimal design; clean layouts, white space, a restrained palette, clear type; nothing on screen without a purpose; calm, consistent screens; one layout pattern across modules; clear tables; short menus.
- Voice: plain, short, factual. Glossary terms only. No exclamation marks or marketing tone.

## Evidence on Hand

- Client brief: `Problem.md`. Technical design: `docs/tdd.md`. Deployment and demo logins: `docs/deployment.md`.
- Seed data is synthetic; the brief's three sample students (Subhashree Mohanty, Ankit Panda, Farheen Ali) appear with their exact figures.
- No real testimonials, customers, usage metrics or institutional logos exist. Do not fabricate them.

## Product Principles

1. The classroom phone comes first: offline, one thumb, under 30 seconds.
2. A student exists once; never ask anyone to type the same fact twice.
3. Show the state honestly: queued, conflict, locked, not enough data, and what the AI actually counted.
4. Same pattern everywhere, so all-day users stop noticing the interface.
5. Rules decide; AI only explains and asks.

## Accessibility & Inclusion

WCAG 2.2 AA: contrast, target sizes, keyboard and screen-reader support. Status is never colour alone. Phone layouts must work one-handed.
