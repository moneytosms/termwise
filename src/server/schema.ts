import {
  pgTable, text, integer, boolean, timestamp, date, uuid, jsonb, primaryKey, unique, uniqueIndex, index, numeric, serial,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Better Auth tables
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// College setup
export const campus = pgTable("campus", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  // Rules tab; applied on the next daily run
  riskDropPoints: integer("risk_drop_points").notNull().default(10),
  riskMarksPercent: integer("risk_marks_percent").notNull().default(50),
  riskMinSessions: integer("risk_min_sessions").notNull().default(10),
  // Printed on receipts and the portal header
  legalName: text("legal_name"),
  tagline: text("tagline"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  affiliation: text("affiliation"),
  registrationNo: text("registration_no"),
  gstin: text("gstin"),
  logoDataUrl: text("logo_data_url"),
  receiptFooter: text("receipt_footer"),
});
export const department = pgTable("department", {
  id: serial("id").primaryKey(),
  campusId: integer("campus_id").notNull().references(() => campus.id),
  name: text("name").notNull(),
  sanctionedPosts: integer("sanctioned_posts").notNull().default(0),
});
export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => user.id),
  campusId: integer("campus_id").notNull().references(() => campus.id),
  departmentId: integer("department_id").references(() => department.id),
  name: text("name").notNull(),
  role: text("role", { enum: ["faculty", "office_admin", "trust"] }).notNull(),
  designation: text("designation", { enum: ["professor", "associate_professor", "assistant_professor"] }),
  qualification: text("qualification"),
});
export const programme = pgTable("programme", {
  id: serial("id").primaryKey(),
  campusId: integer("campus_id").notNull().references(() => campus.id),
  departmentId: integer("department_id").references(() => department.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  attendanceCutoff: integer("attendance_cutoff").notNull().default(75),
  semesterFeePaise: integer("semester_fee_paise").notNull().default(0),
  sanctionedIntake: integer("sanctioned_intake").notNull().default(60),
  durationYears: integer("duration_years").notNull().default(4),
});
export const batch = pgTable("batch", {
  id: serial("id").primaryKey(),
  programmeId: integer("programme_id").notNull().references(() => programme.id),
  code: text("code").notNull().unique(),
  admissionYear: integer("admission_year").notNull(),
  year: integer("year").notNull(),
  semester: integer("semester").notNull(),
});
export const subject = pgTable("subject", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull().references(() => batch.id),
  facultyId: integer("faculty_id").references(() => staff.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  marksStatus: text("marks_status", { enum: ["draft", "submitted", "locked"] }).notNull().default("draft"),
  kind: text("kind", { enum: ["theory", "lab"] }).notNull().default("theory"),
  semester: integer("semester"), // null = the batch's current semester
  // Mark caps per section; lab fields count only when kind is "lab"
  internalMax: integer("internal_max").notNull().default(40),
  midMax: integer("mid_max").notNull().default(20),
  endMax: integer("end_max").notNull().default(40),
  theoryScale: integer("theory_scale").notNull().default(100), // percent of theory 100 that counts
  labExamMax: integer("lab_exam_max").notNull().default(15),
  vivaMax: integer("viva_max").notNull().default(10),
  ceMax: integer("ce_max").notNull().default(5), // continuous evaluation
});
export const calendarDay = pgTable("calendar_day", {
  id: serial("id").primaryKey(),
  campusId: integer("campus_id").notNull().references(() => campus.id),
  date: date("date").notNull(),
  kind: text("kind", { enum: ["holiday", "exam", "event"] }).notNull(),
  label: text("label").notNull(),
});
export const timetableSlot = pgTable("timetable_slot", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull().references(() => batch.id),
  dayOfWeek: integer("day_of_week").notNull(), // 0 Sunday .. 6 Saturday
  period: integer("period").notNull(),
  periodCount: integer("period_count").notNull().default(1),
  startTime: text("start_time").notNull(), // "09:00" IST
  endTime: text("end_time").notNull(),
  subjectId: integer("subject_id").references(() => subject.id), // null: club, sports, interaction; no attendance
  label: text("label"),
});

// Students
export const student = pgTable("student", {
  id: serial("id").primaryKey(),
  rollNo: text("roll_no").notNull().unique(),
  name: text("name").notNull(),
  batchId: integer("batch_id").notNull().references(() => batch.id),
  mentorId: integer("mentor_id").references(() => staff.id),
  birthDate: date("birth_date").notNull(),
  guardianName: text("guardian_name"),
  guardianPhone: text("guardian_phone"),
  parentConsentAt: timestamp("parent_consent_at"),
  userId: text("user_id").unique().references(() => user.id), // student's own login
  category: text("category", { enum: ["general", "obc", "sc", "st", "ews"] }).notNull().default("general"),
  gender: text("gender", { enum: ["male", "female", "other"] }),
  graduatedOn: date("graduated_on"), // set = alumni
}, (t) => [index("student_batch_idx").on(t.batchId)]);

// Parent logins; one guardian can have several children
export const guardian = pgTable("guardian", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => user.id),
  name: text("name").notNull(),
  phone: text("phone"),
  language: text("language", { enum: ["en", "or"] }).notNull().default("en"),
});
export const guardianStudent = pgTable("guardian_student", {
  guardianId: integer("guardian_id").notNull().references(() => guardian.id),
  studentId: integer("student_id").notNull().references(() => student.id),
  relation: text("relation").notNull(), // "Father", "Mother", ...
}, (t) => [primaryKey({ columns: [t.guardianId, t.studentId] })]);

// Student applies, parent approves, then mentor approves
export const leaveRequest = pgTable("leave_request", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => student.id),
  kind: text("kind", { enum: ["leave", "medical"] }).notNull(),
  fromDate: date("from_date").notNull(),
  toDate: date("to_date").notNull(),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["pending_parent", "pending_mentor", "approved", "rejected", "withdrawn"] }).notNull().default("pending_parent"),
  parentNote: text("parent_note"),
  mentorNote: text("mentor_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
}, (t) => [index("leave_request_student_idx").on(t.studentId)]);

// Staff leave: faculty apply, office admin of the same campus decides
export const staffLeave = pgTable("staff_leave", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staff.id),
  kind: text("kind", { enum: ["casual", "medical", "on_duty"] }).notNull(),
  fromDate: date("from_date").notNull(),
  toDate: date("to_date").notNull(),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected", "withdrawn"] }).notNull().default("pending"),
  note: text("note"),
  decidedById: integer("decided_by_id").references(() => staff.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
}, (t) => [index("staff_leave_staff_idx").on(t.staffId), index("staff_leave_status_idx").on(t.status)]);

// From the portal: a parent's note to the mentor, or a request to correct the student's record
export const portalRequest = pgTable("portal_request", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => student.id),
  kind: text("kind", { enum: ["mentor_note", "profile_correction"] }).notNull(),
  fromUserId: text("from_user_id").notNull().references(() => user.id),
  fromName: text("from_name").notNull(),
  body: text("body").notNull(),
  status: text("status", { enum: ["open", "done"] }).notNull().default("open"),
  reply: text("reply"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

// Student contests a mark or an attendance figure; office resolves it
export const appeal = pgTable("appeal", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => student.id),
  kind: text("kind", { enum: ["mark", "attendance"] }).notNull(),
  componentId: integer("component_id").references(() => markComponent.id),
  sessionId: uuid("session_id").references(() => attendanceSession.id),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["open", "accepted", "rejected"] }).notNull().default("open"),
  response: text("response"),
  resolvedBy: text("resolved_by").references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (t) => [index("appeal_student_idx").on(t.studentId), index("appeal_status_idx").on(t.status)]);

// Admission document checklist
export const studentDocument = pgTable("student_document", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => student.id),
  name: text("name").notNull(),
  status: text("status", { enum: ["pending", "received", "verified"] }).notNull().default("pending"),
  fileId: integer("file_id").references(() => documentFile.id),
}, (t) => [index("student_document_student_idx").on(t.studentId)]);

// Uploaded admission documents, stored inline as base64 text (demo scale)
export const documentFile = pgTable("document_file", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  data: text("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Applicants: people applying to a programme before admission; a confirmed applicant becomes a student
export const applicant = pgTable("applicant", {
  id: serial("id").primaryKey(),
  programmeId: integer("programme_id").notNull().references(() => programme.id),
  batchId: integer("batch_id").notNull().references(() => batch.id),
  name: text("name").notNull(),
  birthDate: date("birth_date").notNull(),
  category: text("category", { enum: ["general", "obc", "sc", "st", "ews"] }).notNull().default("general"),
  gender: text("gender", { enum: ["male", "female", "other"] }),
  guardianName: text("guardian_name").notNull(),
  guardianPhone: text("guardian_phone").notNull(),
  guardianEmail: text("guardian_email"),
  parentConsentAt: timestamp("parent_consent_at"),
  status: text("status", { enum: ["applied", "confirmed", "rejected"] }).notNull().default("applied"),
  rejectReason: text("reject_reason"),
  studentId: integer("student_id").unique().references(() => student.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
}, (t) => [index("applicant_programme_idx").on(t.programmeId), index("applicant_status_idx").on(t.status)]);
// Documents a programme requires; categories null means every category
export const requiredDocument = pgTable("required_document", {
  id: serial("id").primaryKey(),
  programmeId: integer("programme_id").notNull().references(() => programme.id),
  name: text("name").notNull(),
  categories: text("categories").array(),
}, (t) => [unique("required_document_natural").on(t.programmeId, t.name)]);
export const applicantDocument = pgTable("applicant_document", {
  id: serial("id").primaryKey(),
  applicantId: integer("applicant_id").notNull().references(() => applicant.id),
  name: text("name").notNull(),
  status: text("status", { enum: ["pending", "received", "verified"] }).notNull().default("pending"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  fileId: integer("file_id").references(() => documentFile.id),
}, (t) => [unique("applicant_document_natural").on(t.applicantId, t.name)]);

// Attendance
export const attendanceSession = pgTable("attendance_session", {
  id: uuid("id").primaryKey(), // client generated
  batchId: integer("batch_id").notNull().references(() => batch.id),
  subjectId: integer("subject_id").notNull().references(() => subject.id),
  date: date("date").notNull(),
  period: integer("period").notNull(),
  periodCount: integer("period_count").notNull().default(1),
  facultyId: integer("faculty_id").notNull().references(() => staff.id),
  editedAt: timestamp("edited_at", { withTimezone: true }).notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("attendance_session_natural").on(t.batchId, t.subjectId, t.date, t.period)]);
export const attendanceEntry = pgTable("attendance_entry", {
  sessionId: uuid("session_id").notNull().references(() => attendanceSession.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => student.id),
  status: text("status", { enum: ["present", "absent", "late"] }).notNull(),
}, (t) => [primaryKey({ columns: [t.sessionId, t.studentId] }), index("attendance_entry_student_idx").on(t.studentId)]);
export const syncConflict = pgTable("sync_conflict", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => attendanceSession.id),
  kind: text("kind", { enum: ["different_teacher", "late_edit"] }).notNull(),
  facultyId: integer("faculty_id").notNull().references(() => staff.id),
  payload: jsonb("payload").notNull(), // the incoming OutboxItem
  status: text("status", { enum: ["open", "kept", "replaced"] }).notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedBy: text("resolved_by").references(() => user.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

// Marks
export const markComponent = pgTable("mark_component", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => subject.id),
  name: text("name").notNull(),
  maxMarks: integer("max_marks").notNull(),
  position: integer("position").notNull().default(0),
  section: text("section", { enum: ["internal", "mid", "end", "lab_exam", "viva", "ce"] }).notNull().default("internal"),
});
export const mark = pgTable("mark", {
  componentId: integer("component_id").notNull().references(() => markComponent.id),
  studentId: integer("student_id").notNull().references(() => student.id),
  marks: numeric("marks", { precision: 5, scale: 2, mode: "number" }),
}, (t) => [primaryKey({ columns: [t.componentId, t.studentId] })]);
export const result = pgTable("result", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => subject.id),
  studentId: integer("student_id").notNull().references(() => student.id),
  internal: numeric("internal", { precision: 5, scale: 2, mode: "number" }).notNull(),
  theoryScaled: numeric("theory_scaled", { precision: 5, scale: 2, mode: "number" }).notNull(),
  lab: numeric("lab", { precision: 5, scale: 2, mode: "number" }).notNull(),
  total: numeric("total", { precision: 5, scale: 2, mode: "number" }).notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("result_subject_student").on(t.subjectId, t.studentId)]);
export const reportSnapshot = pgTable("report_snapshot", {
  id: serial("id").primaryKey(),
  campusId: integer("campus_id").notNull().references(() => campus.id),
  month: text("month").notNull(), // 'YYYY-MM'
  report: text("report", { enum: ["strength", "shortage", "marks", "fees"] }).notNull(),
  rows: jsonb("rows").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("report_snapshot_natural").on(t.campusId, t.month, t.report)]);

// Fees: money is integer paise; dues are always calculated
export const feeInstalment = pgTable("fee_instalment", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => student.id),
  label: text("label").notNull(),
  dueDate: date("due_date").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  scholarshipPaise: integer("scholarship_paise").notNull().default(0),
  semester: integer("semester"), // null = the batch's current semester
}, (t) => [index("fee_instalment_student_idx").on(t.studentId)]);
export const feePayment = pgTable("fee_payment", {
  id: serial("id").primaryKey(),
  instalmentId: integer("instalment_id").notNull().references(() => feeInstalment.id),
  amountPaise: integer("amount_paise").notNull(),
  mode: text("mode", { enum: ["bank_counter", "mock_link"] }).notNull(),
  reference: text("reference").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
});
export const feeStructure = pgTable("fee_structure", {
  id: serial("id").primaryKey(),
  programmeId: integer("programme_id").notNull().references(() => programme.id),
  category: text("category", { enum: ["general", "obc", "sc", "st", "ews"] }).notNull(),
  semesterFeePaise: integer("semester_fee_paise").notNull(),
}, (t) => [uniqueIndex("fee_structure_programme_category_idx").on(t.programmeId, t.category)]);
export const scholarshipScheme = pgTable("scholarship_scheme", {
  id: serial("id").primaryKey(),
  campusId: integer("campus_id").notNull().references(() => campus.id),
  name: text("name").notNull(),
  fundingSource: text("funding_source", { enum: ["government", "institution", "non_government"] }).notNull(),
  kind: text("kind", { enum: ["fixed", "percent"] }).notNull(),
  value: integer("value").notNull(), // paise when fixed; whole percent 1-100 when percent
  categories: text("categories").array().notNull().default(sql`'{}'::text[]`), // empty = all categories
  active: boolean("active").notNull().default(true),
});
export const scholarshipAward = pgTable("scholarship_award", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => student.id),
  schemeId: integer("scheme_id").notNull().references(() => scholarshipScheme.id),
  semester: integer("semester").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  awardedAt: timestamp("awarded_at").notNull().defaultNow(),
  withdrawnAt: timestamp("withdrawn_at"),
}, (t) => [index("scholarship_award_student_idx").on(t.studentId)]);

// Automation
export const riskFlag = pgTable("risk_flag", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => student.id),
  reasonCodes: jsonb("reason_codes").$type<string[]>().notNull(),
  reasonText: text("reason_text").notNull(),
  reasonSource: text("reason_source", { enum: ["llm", "rule"] }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  active: boolean("active").notNull().default(true),
});
export const mentorTask = pgTable("mentor_task", {
  id: serial("id").primaryKey(),
  flagId: integer("flag_id").notNull().references(() => riskFlag.id),
  mentorId: integer("mentor_id").notNull().references(() => staff.id),
  status: text("status", { enum: ["open", "done", "dismissed"] }).notNull().default("open"),
  note: text("note"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});
export const message = pgTable("message", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => student.id),
  kind: text("kind", { enum: ["shortage", "fee_reminder"] }).notNull(),
  language: text("language", { enum: ["en", "or"] }).notNull(),
  body: text("body").notNull(),
  status: text("status", { enum: ["logged", "blocked_no_consent"] }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const jobRun = pgTable("job_run", {
  id: serial("id").primaryKey(),
  campusId: integer("campus_id").notNull().references(() => campus.id),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  summary: jsonb("summary"),
  trigger: text("trigger", { enum: ["schedule", "manual"] }).notNull(),
});
export const llmUsage = pgTable("llm_usage", {
  day: date("day").primaryKey(),
  count: integer("count").notNull().default(0),
});

// Append-only
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  campusId: integer("campus_id").notNull().references(() => campus.id),
  actorId: text("actor_id").references(() => user.id),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(), // e.g. "marks.lock"
  entity: text("entity").notNull(), // "student" | "subject" | "attendance_session" | "campus" | ...
  entityId: text("entity_id").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  reason: text("reason"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_entity_idx").on(t.entity, t.entityId)]);
// Per-account UI preferences (theme, density, landing page...), synced across devices. Shape: Partial<Settings> in src/lib/settings.ts.
export const userSetting = pgTable("user_setting", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
