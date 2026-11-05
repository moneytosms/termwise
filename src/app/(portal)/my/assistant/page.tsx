import { AssistantChat } from "@/app/(app)/assistant/assistant-chat";
import { availableModels } from "@/server/llm";
import { requireStudent } from "@/server/portal";

export default async function StudentAssistantPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const v = await requireStudent();
  const { q } = await searchParams;
  return (
    <div className="mx-auto max-w-5xl md:-my-4">
      <AssistantChat key={q} role="student" userId={v.userId} models={availableModels()} initial={q?.slice(0, 500)} />
    </div>
  );
}
