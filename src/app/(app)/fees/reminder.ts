/** Under 18 on `today` (both YYYY-MM-DD, IST). */
export const isMinor = (birthDate: string, today: string) => birthDate > `${Number(today.slice(0, 4)) - 18}${today.slice(4)}`;
