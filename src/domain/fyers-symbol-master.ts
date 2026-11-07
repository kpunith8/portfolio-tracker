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
