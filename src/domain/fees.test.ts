import { describe, expect, it } from "vitest";
import { dues, validatePayment, type Instalment } from "./fees";

const i = (o: Partial<Instalment>): Instalment => ({ id: 1, dueDate: "2026-08-01", amountPaise: 100_00, scholarshipPaise: 0, paidPaise: 0, ...o });

describe("dues", () => {
  it("subtracts scholarship and payments, splits overdue by date", () => {
    expect(dues([i({ scholarshipPaise: 10_00, paidPaise: 20_00 }), i({ dueDate: "2026-12-01" })], "2026-11-03"))
      .toEqual({ totalPaise: 170_00, overduePaise: 70_00 });
  });
  it("is not overdue on the due date itself", () => {
    expect(dues([i({ dueDate: "2026-11-03" })], "2026-11-03").overduePaise).toBe(0);
  });
  it("never goes negative when scholarship exceeds the amount", () => {
    expect(dues([i({ scholarshipPaise: 200_00 })], "2026-11-03").totalPaise).toBe(0);
  });
});

describe("validatePayment", () => {
  it("rejects zero, fractions and overpayment", () => {
    expect(validatePayment(i({}), 0)).toBeTruthy();
    expect(validatePayment(i({}), 1.5)).toBeTruthy();
    expect(validatePayment(i({}), 100_01)).toBeTruthy();
    expect(validatePayment(i({}), 100_00)).toBeNull();
  });
});

import { isMinor } from "./templates";
describe("isMinor", () => {
  it("turns 18 on the birthday", () => {
    expect(isMinor("2008-11-03", "2026-11-02")).toBe(true);
    expect(isMinor("2008-11-03", "2026-11-03")).toBe(false);
  });
});
