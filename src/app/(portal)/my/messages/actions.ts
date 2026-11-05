"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { requireParent } from "@/server/portal";
import { guardian, portalRequest } from "@/server/schema";

const langSchema = z.enum(["en", "or"]);
const noteSchema = z.string().trim().min(5, "Write at least 5 characters.").max(1000, "Keep it under 1000 characters.");

/** Sets the language the parent reads college messages in. */
export async function setLanguage(lang: "en" | "or"): Promise<{ error?: string }> {
  const v = await requireParent();
  const parsed = langSchema.safeParse(lang);
  if (!parsed.success) return { error: "Pick English or Odia." };
  await db.update(guardian).set({ language: parsed.data }).where(eq(guardian.id, v.guardianId));
  revalidatePath("/my/messages");
  return {};
}

/** Parent's note to the active child's mentor. The student comes from the session, never the client. */
export async function sendMentorNote(body: string): Promise<{ error?: string }> {
  const v = await requireParent();
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (v.mentorId === null) return { error: "This student has no mentor yet." };

  await db.transaction(async (tx) => {
    await tx.insert(portalRequest).values({
      studentId: v.studentId, kind: "mentor_note", fromUserId: v.userId, fromName: v.name, body: parsed.data,
    });
    await audit(tx, v, { action: "request.mentor_note", entity: "student", entityId: v.studentId, newValue: { length: parsed.data.length } });
  });
  revalidatePath("/my/messages");
  return {};
}
