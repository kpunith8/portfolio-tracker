"use client";
import { useState } from "react";
import { previewDividendPdf } from "../../../../src/app/dashboard/dividend-actions";

export default function Page() {
  const [result, setResult] = useState("");

  return (
    <form
      action={async (data) => {
        const value = await previewDividendPdf(data);

        setResult(
          value.error ||
            `Read ${value.rows.length} entries: ${value.statuses.join(", ")}`,
        );
      }}
    >
      <label>
        Statement
        <input type="file" name="statement" />
      </label>
      <button>Preview</button>
      <p role="status">{result}</p>
    </form>
  );
}
