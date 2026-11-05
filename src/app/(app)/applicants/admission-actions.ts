"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/access";
import { confirmApplicant, rejectApplicant } from "@/server/admission";

const pick = z.coerce.number().int().positive();

function refresh() {
  for (const path of ["/applicants", "/students", "/fees", "/home"]) revalidatePath(path);
}

export async function confirmAdmission(applicantId: number): Promise<{ error?: string; rollNo?: string; studentId?: number }> {
  const v = await requireAdmin();
  const id = pick.safeParse(applicantId);
  if (!id.success) return { error: "Pick an applicant." };
  const r = await confirmApplicant(v, id.data);
  if (!("error" in r)) refresh();
  return r;
}

export async function rejectAdmission(applicantId: number, reason: string): Promise<{ error?: string }> {
  const v = await requireAdmin();
  const id = pick.safeParse(applicantId);
  if (!id.success) return { error: "Pick an applicant." };
  const r = await rejectApplicant(v, id.data, reason);
  if ("error" in r) return { error: r.error };
  refresh();
  return {};
}
