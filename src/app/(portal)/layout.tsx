import { eq } from "drizzle-orm";
import { AppShell } from "@/components/app-shell";
import { SettingsSync } from "@/components/settings-sync";
import { db } from "@/server/db";
import { requirePortal } from "@/server/portal";
import { campus, userSetting } from "@/server/schema";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const v = await requirePortal();
  const [[c], [saved]] = await Promise.all([
    db.select({ name: campus.name }).from(campus).where(eq(campus.id, v.campusId)),
    db.select({ data: userSetting.data }).from(userSetting).where(eq(userSetting.userId, v.userId)),
  ]);
  return (
    <AppShell role={v.role} name={v.name} campus={c.name} kids={v.children} activeKid={v.studentId}>
      <SettingsSync saved={saved?.data ?? null} />
      {children}
    </AppShell>
  );
}
