/** Fixed parent templates. Odia text is flagged in the UI as needing native review. */
export function shortageMessage(lang: "en" | "or", name: string, subject: string, percent: number) {
  return lang === "en"
    ? `Attendance alert: ${name} is at ${percent}% in ${subject}, below the required level. Please contact the college.`
    : `ଉପସ୍ଥାନ ସୂଚନା: ${subject} ରେ ${name} ଙ୍କ ଉପସ୍ଥାନ ${percent}% ଅଟେ, ଯାହା ଆବଶ୍ୟକ ସ୍ତରରୁ କମ୍। ଦୟାକରି କଲେଜ ସହିତ ଯୋଗାଯୋଗ କରନ୍ତୁ।`;
}
export function feeMessage(lang: "en" | "or", name: string, amount: string) {
  return lang === "en"
    ? `Fee reminder: ${amount} is due for ${name}. Pay at the bank counter or with the link below.`
    : `ଶୁଳ୍କ ସ୍ମାରକ: ${name} ଙ୍କ ପାଇଁ ${amount} ବକେୟା ଅଛି। ଦୟାକରି ବ୍ୟାଙ୍କ କାଉଣ୍ଟରରେ ପଇଠ କରନ୍ତୁ।`;
}
export const isMinor = (birthDate: string, today: string) => {
  const y = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return (today.slice(5) < birthDate.slice(5) ? y - 1 : y) < 18;
};
