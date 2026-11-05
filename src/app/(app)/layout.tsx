import { eq } from "drizzle-orm";
import { AppShell } from "@/components/app-shell";
import { SettingsSync } from "@/components/settings-sync";
import { SwRegister } from "@/components/sw-register";
import { requireViewer } from "@/server/access";
import { db } from "@/server/db";
import { campus, userSetting } from "@/server/schema";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const v = await requireViewer();
  const [[c], [saved]] = await Promise.all([
    db.select({ name: campus.name }).from(campus).where(eq(campus.id, v.campusId)),
    db.select({ data: userSetting.data }).from(userSetting).where(eq(userSetting.userId, v.userId)),
  ]);
  return (
    <AppShell role={v.role} name={v.name} campus={c.name}>
      <SettingsSync saved={saved?.data ?? null} />
      {v.role === "faculty" && <SwRegister />}
      {children}
    </AppShell>
  );
}
