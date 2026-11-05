import { describe, expect, it } from "vitest";
import { canDecideDepartmentLeave, departmentLimit, inDepartmentScope } from "./department-scope";

const hod = { role: "hod" as const, departmentId: 1, staffId: 10 };

describe("department scope", () => {
  it("only the HoD is limited to a department", () => {
    expect(departmentLimit(hod)).toBe(1);
    expect(departmentLimit({ role: "office_admin", departmentId: 1 })).toBeNull();
    expect(departmentLimit({ role: "faculty", departmentId: 1 })).toBeNull();
  });
  it("an HoD without a department sees nothing", () => {
    expect(departmentLimit({ role: "hod", departmentId: null })).toBe("none");
    expect(inDepartmentScope({ role: "hod", departmentId: null }, null)).toBe(false);
  });
  it("sees own department, refuses another", () => {
    expect(inDepartmentScope(hod, 1)).toBe(true);
    expect(inDepartmentScope(hod, 2)).toBe(false);
    expect(inDepartmentScope(hod, null)).toBe(false);
  });
  it("unscoped roles see every department", () => {
    expect(inDepartmentScope({ role: "office_admin", departmentId: null }, 2)).toBe(true);
  });
  it("HoD decides leave of faculty in the department only", () => {
    expect(canDecideDepartmentLeave(hod, { staffId: 11, role: "faculty", departmentId: 1 })).toBe(true);
    expect(canDecideDepartmentLeave(hod, { staffId: 12, role: "faculty", departmentId: 2 })).toBe(false);
    expect(canDecideDepartmentLeave(hod, { staffId: 13, role: "office_admin", departmentId: 1 })).toBe(false);
    expect(canDecideDepartmentLeave(hod, { staffId: 10, role: "faculty", departmentId: 1 })).toBe(false);
    expect(canDecideDepartmentLeave({ staffId: 10, departmentId: null }, { staffId: 11, role: "faculty", departmentId: null })).toBe(false);
  });
});
