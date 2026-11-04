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
The state in which a subject's internal marks are final and can only change through a reasoned reopen.
_Avoid_: Freeze, publish

**At-risk flag**:
A marker that a student's attendance or marks meet the configured risk rules; it only creates a mentor task.
_Avoid_: Alert, warning

**Mentor task**:
A follow-up assigned to a student's mentor because of an at-risk flag.
_Avoid_: Ticket, case

**College setup**:
The base records everything else depends on: programmes, batches, subjects, faculty, calendar, timetable and rules.
_Avoid_: Masters, Settings
