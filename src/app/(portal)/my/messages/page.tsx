import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { PageHeader, SectionHeading, StatusPill } from "@/components/page";
import { Pager, paginate } from "@/components/pager";
import { EmptyState } from "@/components/states";
import { db } from "@/server/db";
import { requireParent } from "@/server/portal";
import { portalStudent } from "@/server/portal-data";
import { guardian, message, portalRequest } from "@/server/schema";
import { LanguageToggle, MentorNoteForm } from "./controls";

const ist = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
const KIND = { shortage: "Attendance alert", fee_reminder: "Fee reminder" } as const;

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const v = await requireParent();
  const { page } = await searchParams;
  const s = await portalStudent(v.studentId);
  if (!s) return <EmptyState title="No student record found." />;
  const first = s.name.split(" ")[0];

  const [g] = await db.select({ language: guardian.language }).from(guardian).where(eq(guardian.id, v.guardianId));
  const lang = g.language;

  const messages = await db.select().from(message)
    .where(and(eq(message.studentId, v.studentId), eq(message.language, lang)))
    .orderBy(desc(message.createdAt));
  const inbox = paginate(messages, page, 15);
  const notes = await db.select().from(portalRequest)
    .where(and(eq(portalRequest.studentId, v.studentId), eq(portalRequest.kind, "mentor_note"), eq(portalRequest.fromUserId, v.userId)))
    .orderBy(desc(portalRequest.createdAt));

  return (
    <>
      <PageHeader title="Messages" description={`From the college about ${first}`} actions={<LanguageToggle lang={lang} />} />

      <SectionHeading title="Inbox" count={messages.length} />
      {messages.length === 0 ? <EmptyState title="No messages yet." /> : (
        <ul className="space-y-2">
          {inbox.items.map((m) => {
            const held = m.status === "blocked_no_consent";
            // The sender appends a sign-in link as the last line; it is not message text.
            const body = m.body.replace(/\n\S*\/sign-in\s*$/, "");
            return (
              <li key={m.id} className={held ? "rounded-xl bg-card p-4 text-sm opacity-60 shadow-sheet" : "rounded-xl bg-card p-4 text-sm shadow-sheet"}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{KIND[m.kind]}</span>
                  <time className="text-xs text-muted-foreground tabular-nums">{ist(m.createdAt)}</time>
                </div>
                <p className="mt-2 whitespace-pre-line">{body}</p>
                {held && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Held: the college needs your consent to message you about a minor. <Link href="/my/profile" className="underline underline-offset-2">Review on your profile</Link>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {messages.length > 0 && <Pager page={inbox.page} pages={inbox.pages} href={(p) => `/my/messages?page=${p}`} />}
      {lang === "or" && messages.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Odia text is a fixed template.</p>}

      <SectionHeading title="Write to the mentor" />
      <div className="space-y-3 rounded-xl bg-card p-4 shadow-sheet">
        <p className="text-sm text-muted-foreground">
          {s.mentor ? <>{s.mentor} is {first}&apos;s mentor. They&apos;ll reply here.</> : "No mentor is assigned yet."}
        </p>
        <MentorNoteForm disabled={!s.mentorId} />
      </div>

      <SectionHeading title="Your notes" count={notes.length} />
      {notes.length === 0 ? <EmptyState title="No notes yet." /> : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl bg-card p-4 text-sm shadow-sheet">
              <div className="flex items-center justify-between gap-2">
                <time className="text-xs text-muted-foreground tabular-nums">{ist(n.createdAt)}</time>
                {n.status === "done" ? <StatusPill tone="ok">Replied</StatusPill> : <StatusPill>Open</StatusPill>}
              </div>
              <p className="mt-2 whitespace-pre-line">{n.body}</p>
              {n.reply && (
                <div className="mt-3 border-l-2 border-rule pl-3">
                  <p className="text-xs text-muted-foreground">Mentor&apos;s reply</p>
                  <p className="mt-1 whitespace-pre-line">{n.reply}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
