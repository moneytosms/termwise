"use server";

import { z } from "zod";
import { PRESETS } from "@/lib/settings-boot";
import { getViewer } from "@/server/access";
import { getPortalViewer } from "@/server/portal";
import { db } from "@/server/db";
import { userSetting } from "@/server/schema";

const schema = z.object({
  mode: z.enum(["light", "dark", "system"]),
  preset: z.enum(PRESETS.map((p) => p.id) as [string, ...string[]]),
  reduceMotion: z.boolean(),
  density: z.enum(["comfortable", "compact"]),
  sidebarCollapsed: z.boolean(),
  landing: z.string().regex(/^\/[a-z/]+$/),
  pageSize: z.union([z.literal(10), z.literal(20), z.literal(50)]),
  confirmAttendance: z.boolean(),
  shortcuts: z.boolean(),
}).partial().strip();

/** Saves the signed-in user's preferences so they follow them to other devices. */
export async function saveSettings(input: unknown) {
  const v = (await getViewer()) ?? (await getPortalViewer());
  if (!v) return;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return;
  await db.insert(userSetting).values({ userId: v.userId, data: parsed.data })
    .onConflictDoUpdate({ target: userSetting.userId, set: { data: parsed.data, updatedAt: new Date() } });
}
