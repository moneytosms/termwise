import { auditLog } from "./schema";
import type { Tx } from "./db";
import type { Viewer } from "./access";

const OFFICE_LABEL: Record<string, string> = { admissions: "Admissions", exams: "Exams", accounts: "Accounts", hr: "HR" };

/** Write inside the same transaction as the change it records. */
export function audit(
  tx: Tx,
  v: Pick<Viewer, "name" | "campusId"> & { role?: string } & { userId: string | null }, // null for a parent link, which has no account
  e: { action: string; entity: string; entityId: string | number; oldValue?: unknown; newValue?: unknown; reason?: string },
) {
  return tx.insert(auditLog).values({
    campusId: v.campusId, actorId: v.userId, actorName: v.role && OFFICE_LABEL[v.role] ? `${v.name} (${OFFICE_LABEL[v.role]})` : v.name, // office roles carry their role
    action: e.action, entity: e.entity, entityId: String(e.entityId),
    oldValue: e.oldValue ?? null, newValue: e.newValue ?? null, reason: e.reason ?? null,
  });
}
