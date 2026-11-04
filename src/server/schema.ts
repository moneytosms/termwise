import {
  pgTable, text, integer, boolean, timestamp, date, uuid, jsonb, primaryKey, unique, index, numeric, serial,
} from "drizzle-orm/pg-core";

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
});
export const department = pgTable("department", {
  id: serial("id").primaryKey(),
  campusId: integer("campus_id").notNull().references(() => campus.id),
  name: text("name").notNull(),
});
export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => user.id),
  campusId: integer("campus_id").notNull().references(() => campus.id),
  departmentId: integer("department_id").references(() => department.id),
  name: text("name").notNull(),
  role: text("role", { enum: ["faculty", "office_admin"] }).notNull(),
});
export const programme = pgTable("programme", {
  id: serial("id").primaryKey(),
  campusId: integer("campus_id").notNull().references(() => campus.id),
  departmentId: integer("department_id").references(() => department.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  attendanceCutoff: integer("attendance_cutoff").notNull().default(75),
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
}, (t) => [index("student_batch_idx").on(t.batchId)]);

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
});
export const mark = pgTable("mark", {
  componentId: integer("component_id").notNull().references(() => markComponent.id),
  studentId: integer("student_id").notNull().references(() => student.id),
  marks: numeric("marks", { precision: 5, scale: 2, mode: "number" }),
}, (t) => [primaryKey({ columns: [t.componentId, t.studentId] })]);

// Fees: money is integer paise; dues are always calculated
export const feeInstalment = pgTable("fee_instalment", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => student.id),
  label: text("label").notNull(),
  dueDate: date("due_date").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  scholarshipPaise: integer("scholarship_paise").notNull().default(0),
}, (t) => [index("fee_instalment_student_idx").on(t.studentId)]);
export const feePayment = pgTable("fee_payment", {
  id: serial("id").primaryKey(),
  instalmentId: integer("instalment_id").notNull().references(() => feeInstalment.id),
  amountPaise: integer("amount_paise").notNull(),
  mode: text("mode", { enum: ["bank_counter", "mock_link"] }).notNull(),
  reference: text("reference").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
});

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
