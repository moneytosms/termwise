import { PageHeader } from "@/components/page";
import { requireAdmin } from "@/server/access";
import { AssistantChat } from "./assistant-chat";

export default async function AssistantPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Assistant" description="Ask about students, attendance, marks and fees. It only reads data, and can't change records." />
      <AssistantChat />
    </div>
  );
}
