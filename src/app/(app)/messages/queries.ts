import { KIND, LANGUAGE, STATUS } from "./labels";
import { desc, eq } from "drizzle-orm";
import { istDate } from "@/domain/attendance";
import { studentScope, type Viewer } from "@/server/access";
import { db } from "@/server/db";
import { batch, message, programme, student } from "@/server/schema";


export type MessageRow = {
  id: number; at: string; day: string; rollNo: string; name: string;
  kind: string; language: string; status: string; body: string;
};

/** Campus messages, newest first. `day` is the IST date, used for the today figures. */
export async function listMessages(v: Viewer): Promise<MessageRow[]> {
  const rows = await db.select({
    id: message.id, createdAt: message.createdAt, rollNo: student.rollNo, name: student.name,
    kind: message.kind, language: message.language, status: message.status, body: message.body,
  }).from(message)
    .innerJoin(student, eq(message.studentId, student.id))
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(studentScope(v))
    .orderBy(desc(message.createdAt), desc(message.id));

  return rows.map((r) => ({
    id: r.id, at: r.createdAt.toISOString(), day: istDate(r.createdAt), rollNo: r.rollNo, name: r.name,
    kind: KIND[r.kind], language: LANGUAGE[r.language], status: STATUS[r.status], body: r.body,
  }));
}
