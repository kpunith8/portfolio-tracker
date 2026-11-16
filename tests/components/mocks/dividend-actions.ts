export async function getDividendReport() {
  return { rows: [] };
}

export async function previewDividendPdf(form: FormData) {
  const file = form.get("statement");
  const name = file instanceof File ? file.name : "";

  return {
    statuses: [
      name === "duplicate.pdf"
        ? ("duplicate" as const)
        : name === "conflict.pdf"
          ? ("conflict" as const)
          : ("new" as const),
    ],
    rows: [
      {
        company: "TEST LTD",
        isin: "INE123A01012",
        exDate: "2025-06-15",
        shares: "10",
        perShare: "2",
        netAmount: "20",
        symbol: null,
      },
    ],
  };
}

export async function saveDividendRows() {
  return { inserted: 1 };
}
