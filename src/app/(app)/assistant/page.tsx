import { PageHeader } from "@/components/page";
import { requireViewer } from "@/server/access";
import { AssistantChat } from "./assistant-chat";

const DESCRIPTION = {
  office_admin: "Ask Termy about students, attendance, marks and fees on your campus. It only reads data, and can't change records.",
  faculty: "Ask Termy about the subjects you teach: your students, their attendance and marks. It only reads data, and can't change records.",
};

export default async function AssistantPage() {
  const v = await requireViewer();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Termy" description={DESCRIPTION[v.role]} />
      <AssistantChat role={v.role} />
    </div>
  );
}
