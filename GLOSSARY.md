# College ERP

One system for a trust's colleges, where a student exists once from admission to graduation.

## Language

**Subject**:
A unit of study within a programme that has its own attendance and marks.
_Avoid_: Course, paper

**Attendance shortage**:
A student's cumulative attendance in one subject falling below 75%, a cutoff set per programme.
_Avoid_: Low attendance, defaulter

**Batch**:
One programme's cohort by admission year, and the unit a class is taught to.
_Avoid_: Section, class, group

**Attendance session**:
One record of who attended a subject for a batch on a date and period.
_Avoid_: Attendance sheet, register

**Moderation lock**:
The state in which a subject's marks are final and can only change through a reasoned reopen. An accepted appeal can still correct one locked mark.
_Avoid_: Freeze, publish

**At-risk flag**:
A marker that a student's attendance or marks meet the configured risk rules; it only creates a mentor task.
_Avoid_: Alert, warning

**Mentor task**:
A follow-up assigned to a student's mentor because of an at-risk flag.
_Avoid_: Ticket, case

**College setup**:
The base records everything else depends on: college profile, programmes, batches, subjects with their marks schemes, faculty, calendar, timetable and rules.
_Avoid_: Masters, Settings

**Marks scheme**:
How a subject's marks are split: its kind (theory or lab), the maximum of each section and the theory scale. Set per subject in College setup.
_Avoid_: Grading, pattern

**Section**:
One part of a marks scheme: Internal, Mid-term exam, End-term exam, Lab exam, Viva or Continuous evaluation. Each mark component belongs to one section. Not a batch.
_Avoid_: Batch, class

**Mark component**:
A named item with a maximum inside a section, such as Internal test (20) or Assignment (10). Faculty define a subject's internal components.
_Avoid_: Mark item, column

**Internal marks**:
The internal section only, out of 40 by default. The brief's "Internal Marks of 40", the university upload's InternalTotal and the at-risk marks rule use it. Mid-term and end-term exams are not included.
_Avoid_: Total marks

**Theory scale**:
The share of the theory total (out of 100) that counts toward a subject's final score: 100 for theory subjects, 70 for labs.
_Avoid_: Weight, multiplier

**Final score**:
A subject's mark out of 100: theory (internal, mid-term and end-term exams) scaled by the theory scale, plus lab exam, viva and continuous evaluation for a lab.
_Avoid_: Grade, total

**Appeal**:
A student's request to correct one mark, or one absent or late attendance entry, with a reason. Subject faculty or the office admin decide it once: accept with the corrected value, or reject with a response.
_Avoid_: Dispute, complaint

**College profile**:
The college's printed identity: legal name, tagline, affiliation, registration number, GSTIN, address, contact, logo and receipt footer. Set by the office admin in College setup and printed on receipts.
_Avoid_: Campus details, letterhead

**Verification hash**:
An HMAC over a receipt's fixed fields, printed with the receipt and encoded in its QR code. The public verify page recomputes it to confirm the receipt is genuine.
_Avoid_: Checksum, signature
