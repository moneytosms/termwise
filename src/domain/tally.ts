import { istDate } from "./attendance";

export type TallyRow = {
  receiptNo: string; paidAt: Date; rollNo: string; studentName: string; instalmentLabel: string;
  reference: string; amountPaise: number; mode: "bank_counter" | "mock_link"; programmeCode: string;
};

const BANK_LEDGER = { bank_counter: "Bank Counter", mock_link: "Payment Gateway (Test)" } as const;
const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

export const xmlEscape = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

/** Integer paise to a two-decimal rupee string. No floats. */
export const rupeeAmount = (paise: number) => `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;

function voucher(r: TallyRow): string {
  const amount = rupeeAmount(r.amountPaise);
  const narration = `${r.rollNo} ${r.studentName} ${r.instalmentLabel} ref ${r.reference}`;
  return `  <TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="Receipt" ACTION="Create">
    <DATE>${istDate(r.paidAt).replaceAll("-", "")}</DATE><VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME><VOUCHERNUMBER>${xmlEscape(r.receiptNo)}</VOUCHERNUMBER>
    <NARRATION>${xmlEscape(narration)}</NARRATION>
    <ALLLEDGERENTRIES.LIST><LEDGERNAME>${BANK_LEDGER[r.mode]}</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-${amount}</AMOUNT></ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST><LEDGERNAME>${xmlEscape(`Fees Received - ${r.programmeCode}`)}</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>${amount}</AMOUNT></ALLLEDGERENTRIES.LIST>
  </VOUCHER></TALLYMESSAGE>`;
}

/** Tally ERP 9 "Import Data" envelope with one Receipt voucher per row. Format assumed, not confirmed for TallyPrime. */
export function tallyReceiptsXml(rows: TallyRow[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC><REQUESTDATA>
${rows.map(voucher).join("\n")}
</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>
`;
}
