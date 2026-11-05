import { requireViewer } from "@/server/access";
import { availableModels } from "@/server/llm";
import { AssistantChat } from "./assistant-chat";

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const v = await requireViewer();
  const { q } = await searchParams;
  return (
    <div className="mx-auto max-w-5xl md:-my-4">
      <AssistantChat key={q} role={v.role} userId={v.userId} models={availableModels()} initial={q?.slice(0, 500)} />
    </div>
  );
}
