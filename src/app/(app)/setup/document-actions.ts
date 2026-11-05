"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/access";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { programme, requiredDocument } from "@/server/schema";
import { APPLICANT_CATEGORIES } from "@/domain/applicants";

type Result = { error?: string };

const optId = z.preprocess((x) => (x === "" || x == null ? null : x), z.coerce.number().int().positive().nullable());
const docInput = z.object({
  id: optId,
  programmeId: optId,
  name: z.string().trim().min(1, "Name is required.").max(120, "Name is too long."),
});

function parse<S extends z.ZodType>(schema: S, fd: FormData) {
  const r = schema.safeParse(Object.fromEntries(fd));
  return r.success ? { ok: true as const, data: r.data } : { ok: false as const, error: r.error.issues[0].message };
}

export async function saveRequiredDocument(fd: FormData): Promise<Result> {
  const v = await requireAdmin();
  const p = parse(docInput, fd);
  if (!p.ok) return { error: p.error };
  const cats = z.array(z.enum(APPLICANT_CATEGORIES)).safeParse(fd.getAll("categories"));
  if (!cats.success) return { error: "Pick categories from the list." };
  const categories = cats.data.length > 0 ? cats.data : null;
  const { id, programmeId, name } = p.data;
  if (!id && !programmeId) return { error: "Pick a programme." };

  const error = await db.transaction(async (tx) => {
    let programmeFor: number;
    if (id) {
      const [old] = await tx.select({ doc: requiredDocument }).from(requiredDocument)
        .innerJoin(programme, eq(requiredDocument.programmeId, programme.id))
        .where(and(eq(requiredDocument.id, id), eq(programme.campusId, v.campusId)));
      if (!old) return "Document not found on this campus.";
      programmeFor = old.doc.programmeId;
      const [dup] = await tx.select({ id: requiredDocument.id }).from(requiredDocument)
        .where(and(eq(requiredDocument.programmeId, programmeFor), eq(requiredDocument.name, name), ne(requiredDocument.id, id)));
      if (dup) return "This programme already requires a document with that name.";
      const [row] = await tx.update(requiredDocument).set({ name, categories }).where(eq(requiredDocument.id, id)).returning();
      await audit(tx, v, { action: "setup.document", entity: "required_document", entityId: id, oldValue: old.doc, newValue: row });
    } else {
      const [prog] = await tx.select({ id: programme.id }).from(programme)
        .where(and(eq(programme.id, programmeId!), eq(programme.campusId, v.campusId)));
      if (!prog) return "Pick a programme from this campus.";
      programmeFor = prog.id;
      const [dup] = await tx.select({ id: requiredDocument.id }).from(requiredDocument)
        .where(and(eq(requiredDocument.programmeId, programmeFor), eq(requiredDocument.name, name)));
      if (dup) return "This programme already requires a document with that name.";
      const [row] = await tx.insert(requiredDocument).values({ programmeId: programmeFor, name, categories }).returning();
      await audit(tx, v, { action: "setup.document", entity: "required_document", entityId: row.id, newValue: row });
    }
    return null;
  });
  if (error) return { error };
  revalidatePath("/setup");
  return {};
}

export async function deleteRequiredDocument(id: number): Promise<Result> {
  const v = await requireAdmin();
  const did = z.coerce.number().int().positive().safeParse(id);
  if (!did.success) return { error: "Pick a document." };
  const error = await db.transaction(async (tx) => {
    const [old] = await tx.select({ doc: requiredDocument }).from(requiredDocument)
      .innerJoin(programme, eq(requiredDocument.programmeId, programme.id))
      .where(and(eq(requiredDocument.id, did.data), eq(programme.campusId, v.campusId)));
    if (!old) return "Document not found on this campus.";
    await tx.delete(requiredDocument).where(eq(requiredDocument.id, old.doc.id));
    await audit(tx, v, { action: "setup.document", entity: "required_document", entityId: old.doc.id, oldValue: old.doc });
    return null;
  });
  if (error) return { error };
  revalidatePath("/setup");
  return {};
}
