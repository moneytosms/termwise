export type StaffRole = "faculty" | "office_admin" | "admissions" | "exams" | "accounts" | "hr" | "hod";
export type Capability =
  | "teach"            // own classes, mark attendance, edit own subjects' draft marks, offline worker
  | "campus_students"  // every student on the campus
  | "attendance"       // attendance sessions, conflicts, corrections
  | "admissions"       // applicants, documents, confirm
  | "moderate_marks"   // send back, lock, reopen, marks export, mark sheets
  | "fees"             // fees, payments, reminders, Tally
  | "risk" | "messages"
  | "office_requests"  // office side of Requests (record corrections, attendance appeals, leave overview)
  | "appeals"          // decide appeals on marks
  | "staff_leave"      // decide staff leave
  | "reports"          // strength, attendance and marks returns
  | "fee_reports"      // the fees return
  | "setup"            // every College setup tab
  | "setup_faculty"    // the faculty list in College setup
  | "audit"
  | "dept_students"    // read-only: students, attendance, marks status and at-risk flags of the viewer's own department
  | "attendance_view"  // read the attendance sessions page, no corrections or conflict decisions
  | "marks_view"       // read the marks subject list and sheets, no edits or moderation
  | "risk_view"        // read the at-risk flags, no run
  | "dept_leave";      // decide pending leave of faculty in the viewer's own department
const OFFICE: Capability[] = ["campus_students", "attendance", "admissions", "moderate_marks", "fees", "risk", "messages", "office_requests", "appeals", "staff_leave", "reports", "fee_reports", "setup", "setup_faculty", "audit"];
export const CAPS: Record<StaffRole, readonly Capability[]> = {
  faculty: ["teach"],
  office_admin: OFFICE,
  admissions: ["admissions", "campus_students"],
  exams: ["moderate_marks", "reports", "appeals"],
  accounts: ["fees", "fee_reports"],
  hr: ["staff_leave", "setup_faculty"],
  hod: ["dept_students", "attendance_view", "marks_view", "risk_view", "dept_leave"],
};
export const ROLE_LABEL: Record<StaffRole, string> = { faculty: "Faculty", office_admin: "Office admin", admissions: "Admissions", exams: "Exams", accounts: "Accounts", hr: "HR", hod: "Head of department" };
export const isStaffRole = (r: string): r is StaffRole => r in CAPS;
export const TEACHING_ROLES: readonly StaffRole[] = ["faculty", "hod"];
export const isTeacher = (role: string) => (TEACHING_ROLES as readonly string[]).includes(role);
export const can = (role: StaffRole, cap: Capability) => CAPS[role].includes(cap);
export const canAny = (role: StaffRole, caps: readonly Capability[]) => caps.some((c) => can(role, c));
