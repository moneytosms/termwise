import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

// Needs a migrated, seeded database: DATABASE_URL (owner) and ASSISTANT_DATABASE_URL (read-only role).
const owner = process.env.DATABASE_URL, assistant = process.env.ASSISTANT_DATABASE_URL;

describe.skipIf(!owner || !assistant)("assistant views scope by role in the database", () => {
  const admin = new Pool({ connectionString: owner, max: 1 });
  const ro = new Pool({ connectionString: assistant, max: 1 });
  afterAll(() => Promise.all([admin.end(), ro.end()]));

  async function asViewer(sql: string, campusId: number, role: string, staffId: number, studentId = 0, departmentId = 0) {
    const c = await ro.connect();
    try {
      await c.query("BEGIN READ ONLY");
      await c.query("SELECT set_config('app.campus_id', $1, true), set_config('app.role', $2, true), set_config('app.staff_id', $3, true), set_config('app.student_id', $4, true), set_config('app.department_id', $5, true)",
        [String(campusId), role, String(staffId), String(studentId), String(departmentId || "")]);
      return (await c.query(sql)).rows;
    } finally {
      await c.query("ROLLBACK");
      c.release();
    }
  }

  async function staffOf(email: string) {
    const { rows: [s] } = await admin.query(`SELECT s.id, s.campus_id FROM staff s JOIN "user" u ON u.id = s.user_id WHERE u.email = $1`, [email]);
    return s as { id: number; campus_id: number };
  }

  it("faculty see only their subjects and no fees; admin sees the campus", async () => {
    const f = await staffOf("cse.faculty@termwise.demo");
    const a = await staffOf("eng.admin@termwise.demo");
    const { rows: taught } = await admin.query("SELECT code FROM subject WHERE faculty_id = $1", [f.id]);
    const mine = new Set(taught.map((r) => r.code));

    const marks = await asViewer("SELECT DISTINCT subject_code FROM v_marks", f.campus_id, "faculty", f.id);
    const att = await asViewer("SELECT DISTINCT subject_code FROM v_subject_attendance", f.campus_id, "faculty", f.id);
    for (const r of [...marks, ...att]) expect(mine).toContain(r.subject_code);
    expect(await asViewer("SELECT * FROM v_fee_dues", f.campus_id, "faculty", f.id)).toHaveLength(0);

    const facultyStudents = await asViewer("SELECT count(*)::int AS n FROM v_students", f.campus_id, "faculty", f.id);
    const adminStudents = await asViewer("SELECT count(*)::int AS n FROM v_students", a.campus_id, "office_admin", a.id);
    expect(facultyStudents[0].n).toBeGreaterThan(0);
    expect(facultyStudents[0].n).toBeLessThan(adminStudents[0].n);
    expect((await asViewer("SELECT count(*)::int AS n FROM v_fee_dues", a.campus_id, "office_admin", a.id))[0].n).toBeGreaterThan(0);
  });

  it("a student sees only their own rows and no flags", async () => {
    const { rows: [me] } = await admin.query(`SELECT s.id, p.campus_id FROM student s JOIN "user" u ON u.id = s.user_id JOIN batch b ON b.id = s.batch_id JOIN programme p ON p.id = b.programme_id WHERE s.roll_no = 'ENG-24-ME-0177'`);
    for (const view of ["v_students", "v_subject_attendance", "v_marks", "v_fee_dues"]) {
      const rows = await asViewer(`SELECT DISTINCT student_id FROM ${view}`, me.campus_id, "student", 0, me.id);
      expect(rows.map((r) => r.student_id), view).toEqual([me.id]);
    }
    expect(await asViewer("SELECT * FROM v_risk_flags", me.campus_id, "student", 0, me.id)).toHaveLength(0);
  });

  it("fails closed when the role isn't set", async () => {
    const c = await ro.connect();
    try {
      await c.query("BEGIN READ ONLY");
      await c.query("SELECT set_config('app.campus_id', '1', true)");
      await expect(c.query("SELECT * FROM v_marks")).rejects.toThrow();
    } finally {
      await c.query("ROLLBACK");
      c.release();
    }
  });
});
