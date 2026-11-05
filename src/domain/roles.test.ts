import { describe, expect, it } from "vitest";
import { CAPS, can, isStaffRole } from "./roles";

const OFFICE = ["campus_students", "attendance", "admissions", "moderate_marks", "fees", "risk", "messages", "office_requests", "staff_leave", "reports", "setup", "audit"];

describe("roles", () => {
  it("faculty can only teach", () => expect(CAPS.faculty).toEqual(["teach"]));
  it("office admin holds every office capability", () => expect([...CAPS.office_admin].sort()).toEqual([...OFFICE].sort()));
  it("faculty cannot take fees", () => expect(can("faculty", "fees")).toBe(false));
  it("office admin cannot teach", () => expect(can("office_admin", "teach")).toBe(false));
  it("trust is not a staff role", () => expect(isStaffRole("trust")).toBe(false));
});
