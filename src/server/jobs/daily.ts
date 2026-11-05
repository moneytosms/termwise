import { generateText } from "ai";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { attendancePercent, istDate, type AttendanceStatus } from "@/domain/attendance";
import { dues } from "@/domain/fees";
import { evaluateRisk } from "@/domain/risk";
import { feeMessage, guardianLanguages, isMinor, shortageMessage } from "@/domain/templates";
import { rupees } from "@/lib/utils";
import { db } from "../db";
import { llmModel, takeLlmQuota } from "../llm";
import { attendanceEntry, attendanceSession, batch, campus, feeInstalment, guardian, guardianStudent, jobRun, mark, markComponent, mentorTask, message, programme, riskFlag, student, subject } from "../schema";

/** The rule has already decided. The LLM only rewords why; the rule's own text stands if it fails. */
async function writeReason(ruleReason: string): Promise<{ text: string; source: "llm" | "rule" }> {
  const model = llmModel();
  if (!model || !(await takeLlmQuota())) return { text: ruleReason, source: "rule" };
  try {
    const { text } = await generateText({
      model, abortSignal: AbortSignal.timeout(10_000),
      system: "Rewrite these facts about a student's attendance and marks as one plain, kind sentence for their mentor. Keep every number exactly. Add no new facts, advice or diagnosis. No names.",
      prompt: ruleReason,
    });
    return text.trim() ? { text: text.trim(), source: "llm" } : { text: ruleReason, source: "rule" };
  } catch {
    return { text: ruleReason, source: "rule" };
  }
}

export async function runDailyJob(campusId: number, trigger: "schedule" | "manual") {
  const today = istDate();
  const fourWeeksAgo = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10);
  const [c] = await db.select().from(campus).where(eq(campus.id, campusId));
  const rules = { dropPoints: c.riskDropPoints, marksPercent: c.riskMarksPercent, minSessions: c.riskMinSessions };

  const students = await db.select({
    id: student.id, name: student.name, mentorId: student.mentorId, birthDate: student.birthDate, consent: student.parentConsentAt, cutoff: programme.attendanceCutoff,
  }).from(student).innerJoin(batch, eq(student.batchId, batch.id)).innerJoin(programme, eq(batch.programmeId, programme.id)).where(and(eq(programme.campusId, campusId), isNull(student.graduatedOn)));
  const ids = students.map((s) => s.id);
  const summary = { flagged: 0, cleared: 0, notEnoughData: 0, messagesLogged: 0, messagesBlocked: 0, llmReasons: 0, ruleReasons: 0 };
  if (!ids.length) return summary;

  const att = await db.select({ studentId: attendanceEntry.studentId, status: attendanceEntry.status, periods: attendanceSession.periodCount, date: attendanceSession.date, subject: subject.name, sessionId: attendanceSession.id })
    .from(attendanceEntry).innerJoin(attendanceSession, eq(attendanceEntry.sessionId, attendanceSession.id)).innerJoin(subject, eq(attendanceSession.subjectId, subject.id))
    .where(and(
      inArray(attendanceEntry.studentId, ids),
      // Only the batch's current subjects: its own, and those not stamped with an earlier semester
      sql`${attendanceSession.subjectId} in (select s.id from subject s join batch b on b.id = s.batch_id where b.id = ${attendanceSession.batchId} and (s.semester is null or s.semester = b.semester))`,
    ));
  const marks = await db.select({ studentId: mark.studentId, marks: mark.marks, max: markComponent.maxMarks }).from(mark).innerJoin(markComponent, eq(mark.componentId, markComponent.id)).where(and(inArray(mark.studentId, ids), eq(markComponent.section, "internal")));
  const instalments = await db.select({
    studentId: feeInstalment.studentId, id: feeInstalment.id, dueDate: feeInstalment.dueDate, amountPaise: feeInstalment.amountPaise, scholarshipPaise: feeInstalment.scholarshipPaise,
    paidPaise: sql<number>`(select coalesce(sum(p.amount_paise),0) from fee_payment p where p.instalment_id=fee_instalment.id)`.mapWith(Number),
  }).from(feeInstalment).where(inArray(feeInstalment.studentId, ids));
  const active = await db.select({ id: riskFlag.id, studentId: riskFlag.studentId, codes: riskFlag.reasonCodes }).from(riskFlag).where(and(eq(riskFlag.active, true), inArray(riskFlag.studentId, ids)));
  const sentToday = await db.select({ studentId: message.studentId, kind: message.kind }).from(message).where(and(inArray(message.studentId, ids), sql`(${message.createdAt} at time zone 'Asia/Kolkata')::date = ${today}`));

  const guardians = await db.select({ studentId: guardianStudent.studentId, language: guardian.language }).from(guardianStudent)
    .innerJoin(guardian, eq(guardianStudent.guardianId, guardian.id)).where(inArray(guardianStudent.studentId, ids));

  const msgs: (typeof message.$inferInsert)[] = [];
  const addMessages = (s: (typeof students)[number], kind: "shortage" | "fee_reminder", text: (lang: "en" | "or") => string) => {
    if (sentToday.some((m) => m.studentId === s.id && m.kind === kind)) return; // a second run the same day doesn't repeat
    const status = isMinor(s.birthDate, today) && !s.consent ? "blocked_no_consent" as const : "logged" as const;
    const langs = guardianLanguages(guardians.filter((g) => g.studentId === s.id).map((g) => g.language));
    summary[status === "logged" ? "messagesLogged" : "messagesBlocked"] += langs.length;
    const link = `\n${process.env.BETTER_AUTH_URL ?? ""}/sign-in`;
    msgs.push(...langs.map((language) => ({ studentId: s.id, kind, language, body: text(language) + link, status })));
  };

  for (const s of students) {
    const rows = att.filter((a) => a.studentId === s.id);
    const bySubject = new Map<string, { status: AttendanceStatus; periods: number }[]>();
    for (const r of rows) bySubject.set(r.subject, [...(bySubject.get(r.subject) ?? []), r]);
    const subjectPercents = [...bySubject].map(([name, xs]) => ({ subject: name, percent: attendancePercent(xs), cutoff: s.cutoff }));
    const earlier = rows.filter((r) => r.date < fourWeeksAgo);
    const entered = marks.filter((m) => m.studentId === s.id && m.marks !== null);

    const risk = evaluateRisk({
      subjectPercents, overallNow: attendancePercent(rows), overallFourWeeksAgo: attendancePercent(earlier),
      sessionsHeld: new Set(rows.map((r) => r.sessionId)).size,
      marksObtained: entered.reduce((n, m) => n + (m.marks ?? 0), 0), marksPossible: entered.reduce((n, m) => n + m.max, 0),
    }, rules);

    const current = active.find((f) => f.studentId === s.id);
    if (risk.status === "flagged") {
      // Same reasons as the open flag: leave it, so the mentor's task isn't duplicated.
      if (!current || JSON.stringify(current.codes) !== JSON.stringify(risk.codes)) {
        const reason = await writeReason(risk.reason);
        summary[reason.source === "llm" ? "llmReasons" : "ruleReasons"]++;
        await db.transaction(async (tx) => {
          if (current) await tx.update(riskFlag).set({ active: false }).where(eq(riskFlag.id, current.id));
          const [flag] = await tx.insert(riskFlag).values({ studentId: s.id, reasonCodes: risk.codes, reasonText: reason.text, reasonSource: reason.source }).returning();
          if (s.mentorId) await tx.insert(mentorTask).values({ flagId: flag.id, mentorId: s.mentorId });
        });
      }
      summary.flagged++;
    } else {
      if (risk.status === "not_enough_data") summary.notEnoughData++;
      if (current && risk.status === "clear") { await db.update(riskFlag).set({ active: false }).where(eq(riskFlag.id, current.id)); summary.cleared++; }
    }

    const short = subjectPercents.filter((x) => x.percent !== null && x.percent < x.cutoff).sort((a, b) => a.percent! - b.percent!)[0];
    if (short) addMessages(s, "shortage", (lang) => shortageMessage(lang, s.name, short.subject, short.percent!));
    const { overduePaise } = dues(instalments.filter((i) => i.studentId === s.id), today);
    if (overduePaise > 0) addMessages(s, "fee_reminder", (lang) => feeMessage(lang, s.name, rupees(overduePaise)));
  }
  for (let i = 0; i < msgs.length; i += 1000) await db.insert(message).values(msgs.slice(i, i + 1000));
  await db.insert(jobRun).values({ campusId, trigger, summary });
  return summary;
}
