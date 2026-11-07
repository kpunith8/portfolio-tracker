/** Match only an unambiguous BSE ticker for the exact ISIN in FYERS' symbol master. */
export function bseSymbolForIsin(csv: string, isin: string): string | null {
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return null;

  const symbols = new Set<string>();

  for (const line of csv.split(/\r?\n/)) {
    if (!line.includes(isin)) continue;

    const fields: string[] = [];
    let field = "",
      quoted = false;

    for (let index = 0; index < line.length; index++) {
      const character = line[index];

      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          field += '"';
          index++;
        } else quoted = !quoted;
      } else if (character === "," && !quoted) {
        fields.push(field);
        field = "";
      } else field += character;
    }

    if (quoted) continue;
    fields.push(field);
    if (
      fields[5] === isin &&
      /^BSE:[A-Z0-9&.-]+-[A-Z0-9]+$/.test(fields[9] || "")
    )
      symbols.add(fields[9]);
  }

  return symbols.size === 1 ? [...symbols][0] : null;
}

export type MasterSymbol = {
  symbol: string;
  exchange: "NSE" | "BSE";
  name: string;
  fyersSymbol: string;
  isin: string;
};

/** Parse FYERS cash-market records without merging separate trading series. */
export function parseSymbolMaster(
  csv: string,
  exchange: "NSE" | "BSE",
): MasterSymbol[] {
  const result: MasterSymbol[] = [];

  for (const line of csv.split(/\r?\n/)) {
    if (!line.trim()) continue;

    const fields: string[] = [];
    let value = "";
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (quoted && line[i + 1] === '"') {
          value += '"';
          i++;
        } else quoted = !quoted;
      } else if (char === "," && !quoted) {
        fields.push(value);
        value = "";
      } else value += char;
    }

    if (quoted) throw new Error("Malformed symbol master");
    fields.push(value);

    const fyersSymbol = fields[9];
    const symbol = fields[13];

    if (
      !fields[1] ||
      !symbol ||
      !fyersSymbol?.startsWith(`${exchange}:`) ||
      !/^[A-Z0-9&.:-]+$/.test(fyersSymbol)
    )
      throw new Error("Unexpected symbol master record");
    result.push({
      symbol,
      exchange,
      name: fields[1],
      fyersSymbol,
      isin: fields[5],
    });
  }

  return result;
}
