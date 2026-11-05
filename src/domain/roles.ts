export type StaffRole = "faculty" | "office_admin";
export type Capability =
  | "teach"            // own classes, mark attendance, edit own subjects' draft marks, offline worker
  | "campus_students"  // every student on the campus
  | "attendance"       // attendance sessions, conflicts, corrections
  | "admissions"       // applicants, documents, confirm
  | "moderate_marks"   // send back, lock, reopen, marks export, mark sheets
  | "fees"             // fees, payments, reminders, Tally
  | "risk" | "messages"
  | "office_requests"  // office side of Requests (corrections, appeals as office)
  | "staff_leave"      // decide staff leave
  | "reports" | "setup" | "audit";
const OFFICE: Capability[] = ["campus_students", "attendance", "admissions", "moderate_marks", "fees", "risk", "messages", "office_requests", "staff_leave", "reports", "setup", "audit"];
export const CAPS: Record<StaffRole, readonly Capability[]> = { faculty: ["teach"], office_admin: OFFICE };
export const isStaffRole = (r: string): r is StaffRole => r in CAPS;
export const can = (role: StaffRole, cap: Capability) => CAPS[role].includes(cap);
