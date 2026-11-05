/** The semester fee for a category: its structure row if there is one, else the programme default. */
export function semesterFee(defaultPaise: number, rows: { category: string; semesterFeePaise: number }[], category: string): number {
  return rows.find((r) => r.category === category)?.semesterFeePaise ?? defaultPaise;
}
