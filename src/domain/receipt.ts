import { createHmac } from "node:crypto";

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
}

/** Indian numbering: crore, lakh, thousand, hundred. */
function words(n: number): string {
  if (n === 0) return "";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7), lakh = Math.floor((n % 1e7) / 1e5), thousand = Math.floor((n % 1e5) / 1e3), rest = n % 1000;
  if (crore) parts.push(`${words(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest >= 100) parts.push(`${ONES[Math.floor(rest / 100)]} Hundred`);
  if (rest % 100) parts.push(twoDigits(rest % 100));
  return parts.join(" ");
}

/** 4250000 paise -> "Rupees Forty-Two Thousand Five Hundred Only". */
export function amountInWords(paise: number): string {
  const rupees = Math.floor(paise / 100), p = paise % 100;
  const r = rupees === 0 ? "Zero" : words(rupees);
  const cents = p ? ` and ${twoDigits(p)} Paise` : "";
  return `Rupees ${r}${cents} Only`;
}

export type ReceiptFields = {
  id: number; rollNo: string; amountPaise: number; paidAt: Date; reference: string; mode: string; instalment: string;
};

/** HMAC-SHA256 over the receipt's fixed fields; `h` on the verify link. Full 64-char hex. */
export function receiptHash(f: ReceiptFields): string {
  const canonical = [f.id, f.rollNo, f.amountPaise, f.paidAt.toISOString(), f.reference, f.mode, f.instalment].join("|");
  const key = process.env.BETTER_AUTH_SECRET || "termwise-dev";
  return createHmac("sha256", key).update(canonical).digest("hex");
}

