import { AppShell } from "@/components/app-shell";
import { SettingsSync } from "@/components/settings-sync";
import { requireTrust } from "@/server/access";

export default async function TrustLayout({ children }: { children: React.ReactNode }) {
  const t = await requireTrust();
  return (
    <AppShell role="trust" name={t.name} campus="All campuses">
      <SettingsSync saved={null} />
      {children}
    </AppShell>
  );
}
