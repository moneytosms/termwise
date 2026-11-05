"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditMarks, canSubmit, SECTIONS, transition, validateComponents, validateMark, type MarksAction } from "@/domain/marks";
import { AccessError, assertSubjectAccess, requireViewer, type Viewer } from "@/server/access";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { mark, markComponent, student, subject } from "@/server/schema";

const key = (componentId: number, studentId: number) => `${componentId}:${studentId}`;

async function guard(v: Viewer, subjectId: number): Promise<{ error: string } | null> {
  try {
    await assertSubjectAccess(v, subjectId);
    return null;
  } catch (e) {
    if (e instanceof AccessError) return { error: e.message };
    throw e;
  }
}

const Cells = z.object({
  subjectId: z.number().int(),
  cells: z.array(z.object({ componentId: z.number().int(), studentId: z.number().int(), value: z.number().nullable() })).max(5000),
});

/** Saves the cells the client changed. Office admins may edit submitted marks; faculty only drafts. */
export async function saveMarks(subjectId: number, cells: unknown): Promise<{ error?: string }> {
  const v = await requireViewer();
  const input = Cells.safeParse({ subjectId, cells });
  if (!input.success) return { error: "Invalid marks." };
  const id = input.data.subjectId;
  const denied = await guard(v, id);
  if (denied) return denied;

  const [s] = await db.select({ status: subject.marksStatus, batchId: subject.batchId }).from(subject).where(eq(subject.id, id));
  if (!canEditMarks(s.status, v.role)) return { error: `Marks are ${s.status}, so they can't be edited.` };

  const components = await db.select({ id: markComponent.id, maxMarks: markComponent.maxMarks }).from(markComponent).where(eq(markComponent.subjectId, id));
  const roster = new Set((await db.select({ id: student.id }).from(student).where(eq(student.batchId, s.batchId))).map((r) => r.id));
  const maxOf = new Map(components.map((c) => [c.id, c.maxMarks]));
  for (const c of input.data.cells) {
    const max = maxOf.get(c.componentId);
    if (max === undefined || !roster.has(c.studentId)) return { error: "The class list or components changed. Refresh and try again." };
    const err = validateMark(c.value, max);
    if (err) return { error: err };
  }

  const existing = await db.select({ componentId: mark.componentId, studentId: mark.studentId, marks: mark.marks })
    .from(mark).innerJoin(markComponent, eq(mark.componentId, markComponent.id)).where(eq(markComponent.subjectId, id));
  const before = new Map(existing.map((m) => [key(m.componentId, m.studentId), m.marks]));
  const changes = input.data.cells.filter((c) => (before.get(key(c.componentId, c.studentId)) ?? null) !== c.value);
  if (changes.length === 0) return {};

  await db.transaction(async (tx) => {
    for (const c of changes) {
      await tx.insert(mark).values({ componentId: c.componentId, studentId: c.studentId, marks: c.value })
        .onConflictDoUpdate({ target: [mark.componentId, mark.studentId], set: { marks: c.value } });
    }
    await audit(tx, v, {
      action: "marks.update", entity: "subject", entityId: id,
      oldValue: Object.fromEntries(changes.map((c) => [key(c.componentId, c.studentId), before.get(key(c.componentId, c.studentId)) ?? null])),
      newValue: Object.fromEntries(changes.map((c) => [key(c.componentId, c.studentId), c.value])),
    });
  });
  revalidatePath(`/marks/${id}`);
  revalidatePath("/marks");
  return {};
}

const Transition = z.object({
  subjectId: z.number().int(),
  action: z.enum(["submit", "send_back", "lock", "reopen"]),
  reason: z.string().max(500).optional(),
});

const schemeColumns = {
  kind: subject.kind, internalMax: subject.internalMax, midMax: subject.midMax, endMax: subject.endMax, theoryScale: subject.theoryScale,
  labExamMax: subject.labExamMax, vivaMax: subject.vivaMax, ceMax: subject.ceMax,
};

/** Submit (faculty), send back, lock, reopen (office admin). The role and status rules live in `transition`. */
export async function transitionMarks(subjectId: number, action: MarksAction, reason?: string): Promise<{ error?: string }> {
  const v = await requireViewer();
  const input = Transition.safeParse({ subjectId, action, reason });
  if (!input.success) return { error: "Invalid action." };
  const id = input.data.subjectId;
  const denied = await guard(v, id);
  if (denied) return denied;

  const [s] = await db.select({ status: subject.marksStatus, batchId: subject.batchId }).from(subject).where(eq(subject.id, id));
  const t = transition(s.status, action, v.role, reason);
  if (!t.ok) return { error: t.error };

  if (action === "submit") {
    const components = await db.select({ id: markComponent.id }).from(markComponent).where(eq(markComponent.subjectId, id));
    const students = await db.select({ id: student.id }).from(student).where(eq(student.batchId, s.batchId));
    const marks = await db.select({ componentId: mark.componentId, marks: mark.marks })
      .from(mark).innerJoin(markComponent, eq(mark.componentId, markComponent.id)).where(eq(markComponent.subjectId, id));
    const err = canSubmit(components, marks, students.length);
    if (err) return { error: err };
  }

  const saved = await db.transaction(async (tx) => {
    const updated = await tx.update(subject).set({ marksStatus: t.to })
      .where(and(eq(subject.id, id), eq(subject.marksStatus, s.status))).returning({ id: subject.id });
    if (updated.length === 0) return false;
    await audit(tx, v, {
      action: `marks.${action}`, entity: "subject", entityId: id,
      oldValue: { marksStatus: s.status }, newValue: { marksStatus: t.to }, reason: reason?.trim() || undefined,
    });
    return true;
  });
  if (!saved) return { error: "Marks changed while you were looking. Refresh and try again." };
  revalidatePath(`/marks/${id}`);
  revalidatePath("/marks");
  return {};
}

const Components = z.object({
  subjectId: z.number().int(),
  components: z.array(z.object({
    id: z.number().int().optional(), name: z.string().max(60), maxMarks: z.number().int(), section: z.enum(SECTIONS),
  })).max(20),
});

/** Faculty edit internal components of a Draft subject; fixed sections are checked against the scheme. Removing a component is blocked once it has marks. */
export async function saveComponents(subjectId: number, components: unknown): Promise<{ error?: string }> {
  const v = await requireViewer();
  const input = Components.safeParse({ subjectId, components });
  if (!input.success) return { error: "Check the component names and marks." };
  const id = input.data.subjectId;
  const next = input.data.components;
  const denied = await guard(v, id);
  if (denied) return denied;

  const [s] = await db.select({ status: subject.marksStatus, ...schemeColumns }).from(subject).where(eq(subject.id, id));
  if (v.role !== "faculty" || !canEditMarks(s.status, v.role)) {
    return { error: "Components can only be changed by faculty while the subject is in Draft." };
  }
  const err = validateComponents(next, s);
  if (err) return { error: err };

  const old = await db.select({ id: markComponent.id, name: markComponent.name, maxMarks: markComponent.maxMarks, section: markComponent.section })
    .from(markComponent).where(eq(markComponent.subjectId, id));
  if (next.some((c) => c.id !== undefined && !old.some((o) => o.id === c.id))) return { error: "Components changed. Refresh and try again." };

  const removed = old.filter((o) => !next.some((c) => c.id === o.id)).map((o) => o.id);
  const entered = await db.select({ componentId: mark.componentId, marks: mark.marks })
    .from(mark).innerJoin(markComponent, eq(mark.componentId, markComponent.id)).where(eq(markComponent.subjectId, id));
  const blocked = entered.some((m) => m.marks !== null
    && (!next.some((c) => c.id === m.componentId) || (next.find((c) => c.id === m.componentId)?.maxMarks ?? 0) < m.marks));
  if (blocked) return { error: "Marks are already entered for a removed component, or above a new maximum." };

  await db.transaction(async (tx) => {
    if (removed.length) {
      await tx.delete(mark).where(inArray(mark.componentId, removed));
      await tx.delete(markComponent).where(inArray(markComponent.id, removed));
    }
    for (const [position, c] of next.entries()) {
      if (c.id === undefined) await tx.insert(markComponent).values({ subjectId: id, name: c.name.trim(), maxMarks: c.maxMarks, position, section: c.section });
      else await tx.update(markComponent).set({ name: c.name.trim(), maxMarks: c.maxMarks, position }).where(eq(markComponent.id, c.id));
    }
    await audit(tx, v, {
      action: "marks.components", entity: "subject", entityId: id,
      oldValue: old.map((o) => ({ name: o.name, maxMarks: o.maxMarks, section: o.section })),
      newValue: next.map((c) => ({ name: c.name.trim(), maxMarks: c.maxMarks, section: c.section })),
    });
  });
  revalidatePath(`/marks/${id}`);
  return {};
}
