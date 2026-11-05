import { eq, inArray } from "drizzle-orm";
import { AppShell } from "@/components/app-shell";
import { SettingsSync } from "@/components/settings-sync";
import { SwRegister } from "@/components/sw-register";
import { myStaffRows, requireViewer } from "@/server/access";
import { db } from "@/server/db";
import { campus, userSetting } from "@/server/schema";
import { can } from "@/domain/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const v = await requireViewer();
  const [[c], [saved], mine] = await Promise.all([
    db.select({ name: campus.name }).from(campus).where(eq(campus.id, v.campusId)),
    db.select({ data: userSetting.data }).from(userSetting).where(eq(userSetting.userId, v.userId)),
    myStaffRows(),
  ]);
  const rows = mine?.rows ?? [];
  const campuses = rows.length > 1
    ? await db.select({ id: campus.id, name: campus.name }).from(campus).where(inArray(campus.id, rows.map((r) => r.campusId)))
    : [];
  return (
    <AppShell role={v.role} name={v.name} campus={c.name} campuses={campuses} activeCampus={v.campusId}>
      <SettingsSync saved={saved?.data ?? null} />
      {can(v.role, "teach") && <SwRegister />}
      {children}
    </AppShell>
  );
}
