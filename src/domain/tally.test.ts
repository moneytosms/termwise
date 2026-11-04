import { describe, expect, it } from "vitest";
import { rupeeAmount, tallyReceiptsXml, type TallyRow } from "./tally";

const row = (o: Partial<TallyRow> = {}): TallyRow => ({
  receiptNo: "R-000123", paidAt: new Date("2026-11-03T05:00:00Z"), rollNo: "CS2601", studentName: "Asha Rao",
  instalmentLabel: "Sem 1 instalment 1", reference: "UTR1", amountPaise: 4500000, mode: "bank_counter",
  programmeCode: "BCA", ...o,
});

describe("tallyReceiptsXml", () => {
  it("writes the bank debit as negative and the fee credit as positive, two decimals", () => {
    const xml = tallyReceiptsXml([row()]);
    expect(xml).toContain("<LEDGERNAME>Bank Counter</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-45000.00</AMOUNT>");
    expect(xml).toContain("<LEDGERNAME>Fees Received - BCA</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>45000.00</AMOUNT>");
  });

  it("formats paise without float drift", () => {
    expect(rupeeAmount(5)).toBe("0.05");
    expect(rupeeAmount(1000)).toBe("10.00");
    expect(rupeeAmount(29999)).toBe("299.99");
  });

  it("uses the mock gateway ledger for mock_link", () => {
    expect(tallyReceiptsXml([row({ mode: "mock_link" })])).toContain("<LEDGERNAME>Payment Gateway (Test)</LEDGERNAME>");
  });

  it("escapes XML in names and references", () => {
    const xml = tallyReceiptsXml([row({ studentName: `Tom & "Jerry" <'x'>`, reference: "a&b" })]);
    expect(xml).toContain("Tom &amp; &quot;Jerry&quot; &lt;&apos;x&apos;&gt;");
    expect(xml).toContain("a&amp;b");
    expect(xml).not.toContain("Tom & ");
  });

  it("dates by IST, so a late-UTC payment lands on the next IST day", () => {
    const xml = tallyReceiptsXml([row({ paidAt: new Date("2026-11-04T20:00:00Z") })]);
    expect(xml).toContain("<DATE>20261105</DATE>");
  });

  it("gives a valid empty envelope for no rows", () => {
    const xml = tallyReceiptsXml([]);
    expect(xml).toContain("<REQUESTDATA>");
    expect(xml).not.toContain("<TALLYMESSAGE");
    expect(xml.trimEnd().endsWith("</ENVELOPE>")).toBe(true);
  });
});
