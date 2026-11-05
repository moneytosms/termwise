import { describe, expect, it } from "vitest";
import { CAPS, can, canAny, isStaffRole } from "./roles";

const OFFICE = ["campus_students", "attendance", "admissions", "moderate_marks", "fees", "risk", "messages", "office_requests", "appeals", "staff_leave", "reports", "fee_reports", "setup", "setup_faculty", "audit"];

describe("roles", () => {
  it("faculty can only teach", () => expect(CAPS.faculty).toEqual(["teach"]));
  it("office admin holds every office capability", () => expect([...CAPS.office_admin].sort()).toEqual([...OFFICE].sort()));
  it("faculty cannot take fees", () => expect(can("faculty", "fees")).toBe(false));
  it("office admin cannot teach", () => expect(can("office_admin", "teach")).toBe(false));
  it("trust is not a staff role", () => expect(isStaffRole("trust")).toBe(false));
  it("the four office roles are staff roles", () => {
    for (const r of ["admissions", "exams", "accounts", "hr"]) expect(isStaffRole(r)).toBe(true);
  });
  it("admissions: applicants and students only", () => expect([...CAPS.admissions].sort()).toEqual(["admissions", "campus_students"]));
  it("exams: marks, non-fee reports, mark appeals", () => expect([...CAPS.exams].sort()).toEqual(["appeals", "moderate_marks", "reports"]));
  it("accounts: fees and the fees return", () => expect([...CAPS.accounts].sort()).toEqual(["fee_reports", "fees"]));
  it("hr: staff leave and the faculty list", () => expect([...CAPS.hr].sort()).toEqual(["setup_faculty", "staff_leave"]));
  it("only accounts and the office admin take fees", () => {
    expect(can("exams", "fees")).toBe(false);
    expect(can("admissions", "fees")).toBe(false);
    expect(can("hr", "fees")).toBe(false);
    expect(can("accounts", "fees")).toBe(true);
  });
  it("no office role teaches or opens full setup", () => {
    for (const r of ["admissions", "exams", "accounts", "hr"] as const) {
      expect(can(r, "teach")).toBe(false);
      expect(can(r, "setup")).toBe(false);
      expect(can(r, "audit")).toBe(false);
    }
  });
  it("canAny matches any listed capability", () => {
    expect(canAny("hr", ["setup", "setup_faculty"])).toBe(true);
    expect(canAny("exams", ["fees", "fee_reports"])).toBe(false);
  });
});
