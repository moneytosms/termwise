import { describe, expect, it } from "vitest";
import { amountInWords, receiptHash, type ReceiptFields } from "./receipt";

const base: ReceiptFields = {
  id: 123, rollNo: "T24CS001", amountPaise: 4250000, paidAt: new Date("2026-08-01T04:30:00.000Z"),
  reference: "MOCK-ABC", mode: "mock_link", instalment: "Sem 1 fee",
};

describe("amountInWords", () => {
  it("writes rupees in Indian numbering", () => {
    expect(amountInWords(4250000)).toBe("Rupees Forty-Two Thousand Five Hundred Only");
  });
  it("uses crore and lakh", () => {
    expect(amountInWords(12345678901)).toBe(
      "Rupees Twelve Crore Thirty-Four Lakh Fifty-Six Thousand Seven Hundred Eighty-Nine and One Paise Only");
  });
  it("adds paise and handles zero", () => {
    expect(amountInWords(50)).toBe("Rupees Zero and Fifty Paise Only");
    expect(amountInWords(10000)).toBe("Rupees One Hundred Only");
  });
});

describe("receiptHash", () => {
  it("is deterministic and 64 hex chars", () => {
    expect(receiptHash(base)).toBe(receiptHash({ ...base }));
    expect(receiptHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("changes when the amount changes", () => {
    expect(receiptHash({ ...base, amountPaise: 4250001 })).not.toBe(receiptHash(base));
  });
});
