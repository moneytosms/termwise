-- The assistant's only surface. These views filter themselves by the campus, role and staff id set
-- for the transaction (faculty: only subjects they teach, no fees; student: only their own rows, no flags), and the role can read nothing
-- else, so a validated query can't widen its scope. An unset setting errors, so scope fails closed.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'termwise_assistant') THEN
    CREATE ROLE termwise_assistant LOGIN PASSWORD 'termwise_assistant_dev' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

CREATE OR REPLACE VIEW v_students WITH (security_barrier = true) AS
SELECT s.id AS student_id, s.roll_no, s.name, b.code AS batch, b.year, b.semester, p.code AS programme, p.name AS programme_name, d.name AS department
FROM student s
JOIN batch b ON b.id = s.batch_id
JOIN programme p ON p.id = b.programme_id
LEFT JOIN department d ON d.id = p.department_id
WHERE p.campus_id = current_setting('app.campus_id')::int
  AND ((current_setting('app.role') = 'student' AND s.id = current_setting('app.student_id')::int) OR current_setting('app.role') = 'office_admin' OR b.id IN (SELECT batch_id FROM subject WHERE faculty_id = current_setting('app.staff_id')::int));

CREATE OR REPLACE VIEW v_subject_attendance WITH (security_barrier = true) AS
SELECT s.id AS student_id, s.roll_no, s.name, b.code AS batch, b.year, p.code AS programme, sub.code AS subject_code, sub.name AS subject_name,
       a.date, e.status, a.period_count AS periods
FROM attendance_entry e
JOIN attendance_session a ON a.id = e.session_id
JOIN student s ON s.id = e.student_id
JOIN subject sub ON sub.id = a.subject_id
JOIN batch b ON b.id = a.batch_id
JOIN programme p ON p.id = b.programme_id
WHERE p.campus_id = current_setting('app.campus_id')::int
  AND ((current_setting('app.role') = 'student' AND s.id = current_setting('app.student_id')::int) OR current_setting('app.role') = 'office_admin' OR sub.faculty_id = current_setting('app.staff_id')::int);

CREATE OR REPLACE VIEW v_student_subject_attendance WITH (security_barrier = true) AS
SELECT student_id, roll_no, name, batch, year, programme, subject_code, subject_name,
       round(100.0 * sum(CASE WHEN status <> 'absent' THEN periods ELSE 0 END) / sum(periods), 1) AS attendance_percent
FROM v_subject_attendance
GROUP BY student_id, roll_no, name, batch, year, programme, subject_code, subject_name;

CREATE OR REPLACE VIEW v_marks WITH (security_barrier = true) AS
SELECT s.id AS student_id, s.roll_no, s.name, b.code AS batch, b.year, p.code AS programme, sub.code AS subject_code, sub.name AS subject_name,
       sub.marks_status, c.name AS component, c.max_marks, m.marks
FROM mark m
JOIN mark_component c ON c.id = m.component_id
JOIN subject sub ON sub.id = c.subject_id
JOIN student s ON s.id = m.student_id
JOIN batch b ON b.id = s.batch_id
JOIN programme p ON p.id = b.programme_id
WHERE p.campus_id = current_setting('app.campus_id')::int
  AND ((current_setting('app.role') = 'student' AND s.id = current_setting('app.student_id')::int) OR current_setting('app.role') = 'office_admin' OR sub.faculty_id = current_setting('app.staff_id')::int);

CREATE OR REPLACE VIEW v_fee_dues WITH (security_barrier = true) AS
SELECT s.id AS student_id, s.roll_no, s.name, b.code AS batch, b.year, p.code AS programme, i.label AS instalment, i.due_date,
       greatest(0, i.amount_paise - i.scholarship_paise - coalesce((SELECT sum(fp.amount_paise) FROM fee_payment fp WHERE fp.instalment_id = i.id), 0)) / 100.0 AS due_rupees
FROM fee_instalment i
JOIN student s ON s.id = i.student_id
JOIN batch b ON b.id = s.batch_id
JOIN programme p ON p.id = b.programme_id
WHERE p.campus_id = current_setting('app.campus_id')::int
  AND (current_setting('app.role') = 'office_admin' OR (current_setting('app.role') = 'student' AND s.id = current_setting('app.student_id')::int));

CREATE OR REPLACE VIEW v_risk_flags WITH (security_barrier = true) AS
SELECT s.id AS student_id, s.roll_no, s.name, b.code AS batch, b.year, p.code AS programme, r.reason_text, r.created_at
FROM risk_flag r
JOIN student s ON s.id = r.student_id
JOIN batch b ON b.id = s.batch_id
JOIN programme p ON p.id = b.programme_id
WHERE r.active AND p.campus_id = current_setting('app.campus_id')::int
  AND (current_setting('app.role') = 'office_admin' OR b.id IN (SELECT batch_id FROM subject WHERE faculty_id = current_setting('app.staff_id')::int));

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM termwise_assistant;
GRANT USAGE ON SCHEMA public TO termwise_assistant;
GRANT SELECT ON v_students, v_subject_attendance, v_student_subject_attendance, v_marks, v_fee_dues, v_risk_flags TO termwise_assistant;
ALTER ROLE termwise_assistant SET default_transaction_read_only = on;
