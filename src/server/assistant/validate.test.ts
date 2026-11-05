import { describe, expect, it } from "vitest";
import { ALLOWED_VIEWS, validateQuery } from "./validate";

const ok = (q: string) => validateQuery(q).then((r) => r.ok);

describe("validateQuery", () => {
  it("accepts SELECTs over allowed views", async () => {
    expect(await ok("select count(*) from v_students where year = 2")).toBe(true);
    expect(await ok("with s as (select * from v_marks) select avg(marks) from s")).toBe(true);
    expect(await ok("select s.name from v_students s join v_fee_dues f on f.student_id = s.student_id")).toBe(true);
  });
  it.each([
    "delete from student",
    "update student set name = 'x'",
    "drop table student",
    "select * from student",
    "select * from public.v_students",
    "select * from pg_catalog.pg_user",
    "select 1; select 2",
    "select * into x from v_students",
    "select * from v_students for update",
    "with d as (delete from student returning *) select * from d",
    "select set_config('app.campus_id', '2', true)",
    "select pg_sleep(10)",
    "select * from generate_series(1, 100000000)",
    "select (select password from account limit 1)",
    "not sql at all",
  ])("rejects %s", async (q) => expect(await ok(q)).toBe(false));
  it("rejects views outside the role's list", async () => {
    const faculty = ALLOWED_VIEWS.filter((v) => v !== "v_fee_dues");
    expect((await validateQuery("select * from v_fee_dues", faculty)).ok).toBe(false);
    expect((await validateQuery("select * from v_marks", faculty)).ok).toBe(true);
  });
});
