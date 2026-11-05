import { describe, expect, it } from "vitest";
import { APPEAL_LABEL, canAppeal, decide, validateReason } from "./appeals";

describe("canAppeal", () => {
  it("lets a student appeal a mark once", () => {
    expect(canAppeal({ role: "student", existingOpen: false, kind: "mark" })).toBe(true);
    expect(canAppeal({ role: "student", existingOpen: true, kind: "mark" })).toBe(false);
  });

  it("never lets a parent appeal", () => {
    expect(canAppeal({ role: "parent", existingOpen: false, kind: "mark" })).toBe(false);
    expect(canAppeal({ role: "parent", existingOpen: false, kind: "attendance", status: "absent" })).toBe(false);
  });

  it("allows attendance appeals only when absent or late", () => {
    expect(canAppeal({ role: "student", existingOpen: false, kind: "attendance", status: "absent" })).toBe(true);
    expect(canAppeal({ role: "student", existingOpen: false, kind: "attendance", status: "late" })).toBe(true);
    expect(canAppeal({ role: "student", existingOpen: false, kind: "attendance", status: "present" })).toBe(false);
    expect(canAppeal({ role: "student", existingOpen: false, kind: "attendance" })).toBe(false);
  });
});

describe("validateReason", () => {
  it("needs 10 to 500 characters after trimming", () => {
    expect(validateReason("         short  ")).toMatch(/at least 10/);
    expect(validateReason("exactly 10")).toBeNull();
    expect(validateReason("x".repeat(500))).toBeNull();
    expect(validateReason("x".repeat(501))).toMatch(/500/);
  });
});

describe("decide", () => {
  it("accepts an open appeal without a response", () => {
    expect(decide("open", "accept")).toEqual({ ok: true, to: "accepted" });
  });

  it("rejects only with a response", () => {
    expect(decide("open", "reject", "  ")).toEqual({ ok: false, error: "Give a reason for rejecting." });
    expect(decide("open", "reject", "Script checked, total is right.")).toEqual({ ok: true, to: "rejected" });
  });

  it("refuses to decide an appeal twice", () => {
    expect(decide("accepted", "reject", "late thought")).toEqual({ ok: false, error: "This appeal is already decided." });
    expect(decide("rejected", "accept")).toMatchObject({ ok: false });
  });

  it("has a label for every status", () => {
    expect(APPEAL_LABEL).toEqual({ open: "Appeal open", accepted: "Accepted", rejected: "Rejected" });
  });
});
