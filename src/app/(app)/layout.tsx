import { eq } from "drizzle-orm";
import { AppShell } from "@/components/app-shell";
import { SwRegister } from "@/components/sw-register";
import { requireViewer } from "@/server/access";
import { db } from "@/server/db";
import { campus } from "@/server/schema";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const v = await requireViewer();
  const [c] = await db.select({ name: campus.name }).from(campus).where(eq(campus.id, v.campusId));
  return (
    <AppShell role={v.role} name={v.name} campus={c.name}>
      {v.role === "faculty" && <SwRegister />}
      {children}
    </AppShell>
  );
}
