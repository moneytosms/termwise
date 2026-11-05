"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { ALUMNI_READ_ONLY, requireParent, requirePortal } from "@/server/portal";
import { message, portalRequest, student } from "@/server/schema";

const correctionSchema = z.object({
  body: z.string().trim()
    .min(10, "Describe the correction in at least 10 characters.")
    .max(500, "Keep it to 500 characters or fewer."),
});

/** Asks the office to correct the student's profile. The student comes from the session, never the client. */
export async function requestCorrection(body: string): Promise<{ error?: string }> {
  const v = await requirePortal();
  if (v.alumni) return { error: ALUMNI_READ_ONLY };
  const parsed = correctionSchema.safeParse({ body });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db.transaction(async (tx) => {
    const [r] = await tx.insert(portalRequest).values({
      studentId: v.studentId, kind: "profile_correction", fromUserId: v.userId, fromName: v.name, body: parsed.data.body,
    }).returning({ id: portalRequest.id });
    await audit(tx, v, { action: "request.profile_correction", entity: "student", entityId: v.studentId, newValue: { requestId: r.id, body: parsed.data.body } });
  });
  revalidatePath("/my/profile");
  revalidatePath("/my");
  return {};
}

/** Parent consent for the active child. Giving it releases held messages; withdrawing only stops new ones being sent. */
export async function setConsent(given: boolean): Promise<{ error?: string }> {
  const v = await requireParent();
  if (v.alumni) return { error: ALUMNI_READ_ONLY };

  const error = await db.transaction(async (tx) => {
    const [before] = await tx.select({ parentConsentAt: student.parentConsentAt }).from(student).where(eq(student.id, v.studentId));
    if (!before) return "This student isn't available to you.";
    const at = given ? new Date() : null;
    await tx.update(student).set({ parentConsentAt: at }).where(eq(student.id, v.studentId));
    if (given) {
      await tx.update(message).set({ status: "logged" })
        .where(and(eq(message.studentId, v.studentId), eq(message.status, "blocked_no_consent")));
    }
    await audit(tx, v, {
      action: "student.consent", entity: "student", entityId: v.studentId,
      oldValue: { parentConsentAt: before.parentConsentAt }, newValue: { parentConsentAt: at },
    });
    return null;
  });
  if (error) return { error };
  revalidatePath("/my/profile");
  revalidatePath("/my");
  return {};
}
