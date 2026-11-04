import { auditLog } from "./schema";
import type { Tx } from "./db";
import type { Viewer } from "./access";

/** Write inside the same transaction as the change it records. */
export function audit(
  tx: Tx,
  v: Pick<Viewer, "name" | "campusId"> & { userId: string | null }, // null for a parent link, which has no account
  e: { action: string; entity: string; entityId: string | number; oldValue?: unknown; newValue?: unknown; reason?: string },
) {
  return tx.insert(auditLog).values({
    campusId: v.campusId, actorId: v.userId, actorName: v.name,
    action: e.action, entity: e.entity, entityId: String(e.entityId),
    oldValue: e.oldValue ?? null, newValue: e.newValue ?? null, reason: e.reason ?? null,
  });
}
