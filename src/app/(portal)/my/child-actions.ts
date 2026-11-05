"use server";

import { cookies } from "next/headers";
import { CHILD_COOKIE, getPortalViewer } from "@/server/portal";

/** Switches the parent's active child. Ignores ids that aren't the parent's own children. */
export async function setChild(studentId: number) {
  const v = await getPortalViewer();
  if (v?.role !== "parent" || !v.children.some((c) => c.id === studentId)) return;
  (await cookies()).set(CHILD_COOKIE, String(studentId), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}
