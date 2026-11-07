const abbreviations = new Set([
  "BSE",
  "EV",
  "ETF",
  "HDFC",
  "ICICI",
  "IDFC",
  "IREDA",
  "ITC",
  "JSW",
  "NCC",
  "NMDC",
  "NSE",
  "ONGC",
  "PFC",
  "SBI",
]);
const smallWords = new Set(["AND", "OF", "THE", "FOR", "IN"]);

/** Format provider-supplied uppercase names for display without changing stored names. */
export function displayCompanyName(name: string) {
  if (name !== name.toUpperCase()) return name;

  return name.replace(/\p{L}[\p{L}\p{M}]*/gu, (word, offset: number) => {
    if (abbreviations.has(word)) return word;
    if (offset > 0 && smallWords.has(word)) return word.toLowerCase();

    return word.charAt(0) + word.slice(1).toLowerCase();
  });
}
