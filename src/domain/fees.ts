export type Instalment = { id: number; dueDate: string; amountPaise: number; scholarshipPaise: number; paidPaise: number };

export const instalmentDue = (i: Instalment) => Math.max(0, i.amountPaise - i.scholarshipPaise - i.paidPaise);

/** Dues are always calculated from instalments, scholarships and payments; never stored. */
export function dues(instalments: Instalment[], today: string) {
  let total = 0, overdue = 0;
  for (const i of instalments) {
    const d = instalmentDue(i);
    total += d;
    if (i.dueDate < today) overdue += d;
  }
  return { totalPaise: total, overduePaise: overdue };
}

/** A payment must be positive and no more than what's left on the instalment. */
export function validatePayment(i: Instalment, paise: number): string | null {
  if (!Number.isInteger(paise) || paise <= 0) return "Enter an amount above zero.";
  return paise > instalmentDue(i) ? "That's more than is due on this instalment." : null;
}
