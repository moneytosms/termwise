Multi-campus college ERP for admissions, attendance, marks and fees

Client

Company A, Bhubaneswar. An educational trust running 3 campuses: an engineering college, a management school and a pharmacy college. 7,800 students, 520 teaching and 340 non-teaching staff, fee revenue ₹95–110 crore a year.

Today

Admissions run on Excel and online forms. Each campus keeps student records in a 12-year-old desktop program. Attendance is on paper, typed into Excel weekly; marks live in department sheets. Fees are paid at a bank counter and matched by hand in Tally. Staff leave is on paper. Reports for the university, AICTE and NAAC are compiled by hand.

The problem

Assumptions: digital attendance and marks save each teacher 1 hour a week: 520 × 1 × 40 teaching weeks = 20,800 hours × ₹600 = ₹1.248 crore. 24 office staff spend 40% of their time re-entering data and building reports: 24 × 40% × ₹3.6 lakh = ₹34.56 lakh. Total ₹1.59 crore a year.

Users

Faculty, students and parents (mobile), and office staff for admissions, exams, accounts and HR. The trust's Secretary signs the deal.

The ask

We run three colleges on paper, Excel and a desktop program nobody can fix. I want one system where a student exists once, from admission to graduation. Teachers should take attendance on their phones in class and enter marks once. Parents should see attendance and dues. When the university or NAAC asks for data, I want a report, not a two-week exercise.

Must have

Masters for campuses, programmes, batches, subjects, faculty and the calendar, with roles per campus
Admission to student record: applicant import, document checklist, confirmation and roll numbers
Period-wise attendance on mobile, working offline in class, with alerts below 75%
Internal marks by component, moderation lock, mark sheets and export in the university upload format
Fees: structures by programme and category, scholarships, payment link (test mode), receipts, dues and Tally export
Staff leave, and dashboards per campus and for the trust
Core build

Software Engineering candidates must ship this slice end to end, in about 6 to 8 screens: one campus only: masters for one programme, mobile attendance, internal marks with moderation lock, and fee dues. Roles: faculty and office admin. AI: at-risk student flag. Hard part: offline attendance in class with sync. Mock payments, messages and outside systems, and seed from the sample data. The rest of MUST HAVE is optional depth.

Out of scope

Timetable generation
Payroll
Hostel, transport and library
Ai or automation

Shortage alerts, fee reminders and standard reports run automatically. AI flags students at risk from attendance and marks trends, and lets office staff ask questions in plain English, such as how many second-year students are below 75% this month, by generating a read-only query. When it is wrong: the assistant shows the filters it used and the row count, runs only read-only queries on data the user's role may see, and cannot change records. At-risk flags only create a mentor task. Attendance and marks rules are fixed settings, not AI.

Constraints

Student and parent data falls under the DPDP Act 2023; some first-year students are minors needing parental consent. Access is limited by campus and department. Marks lock after moderation and every change is logged for exam audits. Reports must match university, AICTE and NAAC formats. Results day brings 7,800 students at once. Classrooms have weak Wi-Fi. English, with Odia for parent messages.

Design

The client values good, minimal design: clean layouts, white space, a restrained palette and clear type, with nothing on screen that lacks a purpose. Design counts as much as features. An ERP is used all day by hundreds of people, so calm, consistent screens matter most: one layout pattern across modules, clear tables, short menus, and attendance marked in under 30 seconds per class.

Budget and time

₹9 lakh, 8 weeks for this first phase. Success: attendance entered the same day for 95% of classes; university mark uploads with no re-typing; monthly fee reconciliation from 10 days to 1.

Sample data

Roll No	Name	Programme	Year	Attendance %	Internal Marks of 40	Fee Due ₹
ENG-24-CSE-0412	Subhashree Mohanty	B.Tech CSE	2	81.5	33	0
ENG-24-ME-0177	Ankit Panda	B.Tech Mechanical	2	68.2	21	45000
MBA-25-0093	Farheen Ali	MBA	1	92.0	36	0
