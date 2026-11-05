import type { StaffRole } from "./roles";

/** Roles whose view of students, attendance and marks is limited to their own department. */
export const isDepartmentScoped = (role: StaffRole) => role === "hod";

/** The department a viewer is limited to: its id, "none" when scoped without a department (sees nothing), or null when not scoped. */
export function departmentLimit(v: { role: StaffRole; departmentId: number | null }): number | "none" | null {
  if (!isDepartmentScoped(v.role)) return null;
  return v.departmentId ?? "none";
}

/** Whether a record in `recordDepartmentId` is visible to the viewer under their department limit. */
export function inDepartmentScope(v: { role: StaffRole; departmentId: number | null }, recordDepartmentId: number | null): boolean {
  const limit = departmentLimit(v);
  if (limit === null) return true;
  return limit !== "none" && recordDepartmentId === limit;
}

/** Whether a leave request is the viewer's to decide as head of department: another faculty member of the same department. */
export function canDecideDepartmentLeave(
  v: { staffId: number; departmentId: number | null },
  applicant: { staffId: number; role: string; departmentId: number | null },
): boolean {
  return v.departmentId !== null && applicant.role === "faculty" && applicant.staffId !== v.staffId && applicant.departmentId === v.departmentId;
}
