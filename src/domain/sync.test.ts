import { describe, expect, it } from "vitest";
import { correctedEditedAt, decideSync } from "./sync";

const t = (s: string) => new Date(`2026-11-03T${s}:00Z`);
const date = "2026-11-03";

describe("decideSync", () => {
  it("inserts the first submission", () => {
    expect(decideSync(null, { facultyId: 1, date, editedAt: t("05:00") })).toEqual({ action: "insert" });
  });
  it("same teacher: newest wins, older and replay ignored", () => {
    const existing = { facultyId: 1, editedAt: t("05:00") };
    expect(decideSync(existing, { facultyId: 1, date, editedAt: t("05:10") })).toEqual({ action: "update" });
    expect(decideSync(existing, { facultyId: 1, date, editedAt: t("04:50") })).toEqual({ action: "ignore" });
    expect(decideSync(existing, { facultyId: 1, date, editedAt: t("05:00") })).toEqual({ action: "ignore" });
  });
  it("different teacher goes to the queue, even if newer", () => {
    expect(decideSync({ facultyId: 1, editedAt: t("05:00") }, { facultyId: 2, date, editedAt: t("05:10") }))
      .toEqual({ action: "conflict", kind: "different_teacher" });
  });
  it("edit made after the session date goes to the queue", () => {
    expect(decideSync(null, { facultyId: 1, date: "2026-11-02", editedAt: t("05:00") }))
      .toEqual({ action: "conflict", kind: "late_edit" });
  });
});

describe("correctedEditedAt", () => {
  const now = t("06:00");
  it("removes device clock skew", () => {
    // device runs 1 hour fast
    expect(correctedEditedAt("2026-11-03T06:30:00Z", "2026-11-03T07:00:00Z", now)).toEqual(t("05:30"));
  });
  it("never lands in the future", () => {
    expect(correctedEditedAt("2026-11-03T08:00:00Z", "2026-11-03T06:00:00Z", now)).toEqual(now);
  });
});
