import { count, desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page";
import { requireAdmin } from "@/server/access";
import { db } from "@/server/db";
import { auditLog } from "@/server/schema";
import { AuditTable } from "./audit-table";

const LIMIT = 2000;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entry?: string }> }) {
  const v = await requireAdmin();
  const { entry } = await searchParams;
  const onCampus = eq(auditLog.campusId, v.campusId);
  const [{ n }] = await db.select({ n: count() }).from(auditLog).where(onCampus);
  const rows = await db.select().from(auditLog).where(onCampus).orderBy(desc(auditLog.at), desc(auditLog.id)).limit(LIMIT);
  const base = "Every change, who made it and why. Entries can't be edited.";
  return (
    <>
      <PageHeader title="Audit log" description={n > LIMIT ? `${base} Showing the latest ${LIMIT} of ${n}.` : base} />
      <AuditTable
        rows={rows.map((r) => ({
          id: r.id, at: r.at.toISOString(), actor: r.actorName, action: r.action, entity: r.entity, entityId: r.entityId,
          reason: r.reason ?? "", oldValue: r.oldValue, newValue: r.newValue,
        }))}
        selectedId={entry}
      />
    </>
  );
}
