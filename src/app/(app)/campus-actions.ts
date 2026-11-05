"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CAMPUS_COOKIE } from "@/domain/active-campus";
import { myStaffRows } from "@/server/access";

/** Switches the active campus. Ignores campuses the user has no staff row on. */
export async function setCampus(campusId: number) {
  const mine = await myStaffRows();
  if (!mine || !mine.rows.some((r) => r.campusId === campusId && r.role !== "trust")) return;
  (await cookies()).set(CAMPUS_COOKIE, String(campusId), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/home");
}
