"use client";

import { useState, type ReactNode } from "react";

export function ReportDetails({
  summary,
  children,
}: {
  summary: ReactNode;
  children: () => ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="tax-period"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{summary}</summary>
      {open ? children() : null}
    </details>
  );
}
