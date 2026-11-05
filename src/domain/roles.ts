export type StaffRole = "faculty" | "office_admin" | "admissions" | "exams" | "accounts" | "hr";
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
  | "audit";
const OFFICE: Capability[] = ["campus_students", "attendance", "admissions", "moderate_marks", "fees", "risk", "messages", "office_requests", "appeals", "staff_leave", "reports", "fee_reports", "setup", "setup_faculty", "audit"];
export const CAPS: Record<StaffRole, readonly Capability[]> = {
  faculty: ["teach"],
  office_admin: OFFICE,
  admissions: ["admissions", "campus_students"],
  exams: ["moderate_marks", "reports", "appeals"],
  accounts: ["fees", "fee_reports"],
  hr: ["staff_leave", "setup_faculty"],
};
export const isStaffRole = (r: string): r is StaffRole => r in CAPS;
export const can = (role: StaffRole, cap: Capability) => CAPS[role].includes(cap);
export const canAny = (role: StaffRole, caps: readonly Capability[]) => caps.some((c) => can(role, c));
