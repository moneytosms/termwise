"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/access";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { campus } from "@/server/schema";

type Result = { error?: string };

const opt = (what: string, max: number) => z.string().trim().max(max, `${what} is too long.`).transform((s) => s || null);
const logo = z.string().regex(/^data:image\/(png|jpeg|svg\+xml|webp);base64,/, "Logo must be a PNG, JPEG, SVG or WebP image.")
  .max(300_000, "Logo is over 200 KB.").nullable();

const collegeInput = z.object({
  legalName: opt("Legal name", 200),
  tagline: opt("Tagline", 200),
  addressLine1: opt("Address line 1", 200),
  addressLine2: opt("Address line 2", 200),
  city: opt("City", 100),
  state: opt("State", 100),
  pincode: opt("Pincode", 10),
  phone: opt("Phone", 60),
  email: opt("Email", 200),
  website: opt("Website", 200),
  affiliation: opt("Affiliation", 300),
  registrationNo: opt("Registration no", 100),
  gstin: opt("GSTIN", 15),
  receiptFooter: opt("Receipt footer", 500),
  logoDataUrl: z.string().transform((s) => s || null).pipe(logo),
});

export async function saveCollege(fd: FormData): Promise<Result> {
  const v = await requireAdmin();
  const r = collegeInput.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0].message };
  await db.transaction(async (tx) => {
    const [old] = await tx.select().from(campus).where(eq(campus.id, v.campusId));
    const [row] = await tx.update(campus).set(r.data).where(eq(campus.id, v.campusId)).returning();
    await audit(tx, v, { action: "setup.college.update", entity: "campus", entityId: v.campusId, oldValue: old, newValue: row });
  });
  revalidatePath("/setup");
  revalidatePath("/my/fees/receipt");
  return {};
}
