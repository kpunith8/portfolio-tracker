export type PurchaseCsvRow = {
  symbol: string;
  exchange: string;
  quantity: string;
  price: string;
  date: string;
};

const columns = ["symbol", "exchange", "quantity", "price", "date"] as const;

export const purchaseCsvTemplate = `${columns.join(",")}\r\n`;

/** Parse CSV records without coercing monetary values to floating point. */
export function parseCsvRecords(csv: string): {
  records?: string[][];
  error?: string;
} {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let closed = false;
  const input = csv.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else field += char;
    } else if (char === '"') {
      if (field || closed) return { error: "Invalid quoted field." };
      quoted = true;
    } else if (char === "," || char === "\n" || char === "\r") {
      record.push(field);
      field = "";
      closed = false;
      if (char !== ",") {
        records.push(record);
        record = [];
        if (char === "\r" && input[i + 1] === "\n") i++;
      }
    } else {
      if (closed) return { error: "Invalid quoted field." };
      field += char;
    }
  }

  if (quoted) return { error: "Unclosed quoted field." };
  if (field || record.length || closed) records.push([...record, field]);

  return { records };
}

export function parsePurchaseCsv(csv: string): {
  rows?: PurchaseCsvRow[];
  error?: string;
} {
  const parsed = parseCsvRecords(csv);

  if (!parsed.records) return { error: parsed.error };

  const records = parsed.records;
  const header = records.shift();

  if (
    !header ||
    header.length !== columns.length ||
    columns.some((column, i) => header[i] !== column)
  )
    return { error: "Use the CSV template headers in the correct order." };
  if (records.some((row) => row.length !== columns.length))
    return { error: "Every row must have exactly five fields." };

  return {
    rows: records.map(([symbol, exchange, quantity, price, date]) => ({
      symbol: symbol.trim(),
      exchange: exchange.trim(),
      quantity: quantity.trim(),
      price: price.trim(),
      date: date.trim(),
    })),
  };
}
