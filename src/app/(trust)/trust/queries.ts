import { eq } from "drizzle-orm";
import { aging, countShort, campusProgrammes, feeRows, activeFlags, shortageByGroup, studentAttendance, subjectAttendance } from "@/app/(app)/home/queries";
import { istDate } from "@/domain/attendance";
import type { CampusFigures } from "@/domain/trust";
import type { Viewer } from "@/server/access";
import { db } from "@/server/db";
import { campus } from "@/server/schema";

/** Read-only scope for one campus: reuses the campus-scoped queries without a staff identity. */
const scopeOf = (campusId: number) => ({ userId: "", name: "", staffId: 0, campusId, departmentId: null, role: "office_admin" }) as Viewer;

export async function campusList() {
  return db.select({ id: campus.id, name: campus.name }).from(campus).orderBy(campus.name);
}

export async function campusFigures(c: { id: number; name: string }, now = new Date()): Promise<CampusFigures> {
  const v = scopeOf(c.id);
  const [att, fees, flags] = await Promise.all([studentAttendance(v, istDate(now)), feeRows(v, now), activeFlags(v)]);
  const duesPaise = aging(fees, istDate(now)).reduce((n, b) => n + b.paise, 0);
  return {
    campusId: c.id,
    name: c.name,
    students: att.length,
    held: att.reduce((n, r) => n + r.held, 0),
    attended: att.reduce((n, r) => n + r.attended, 0),
    shortage: countShort(att),
    duesPaise,
    flags,
  };
}

export async function allCampusFigures(): Promise<CampusFigures[]> {
  const campuses = await campusList();
  return Promise.all(campuses.map((c) => campusFigures(c)));
}

/** Drill-down for one campus: its programmes and subjects with the most students below the line. */
export async function campusDetail(id: number) {
  const [c] = await db.select({ id: campus.id, name: campus.name }).from(campus).where(eq(campus.id, id));
  if (!c) return null;
  const v = scopeOf(c.id);
  const [figures, programmes, subjects] = await Promise.all([
    campusFigures(c),
    campusProgrammes(v),
    subjectAttendance(v).then(shortageByGroup),
  ]);
  return { campus: c, figures, programmes, subjects };
}
