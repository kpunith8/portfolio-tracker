/** Calendar date for an epoch timestamp in the Indian market timezone. */
export function marketDate(epoch: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(epoch * 1000));
}

/** Display a recorded date without shifting its calendar day in other timezones. */
export function formatRecordedDate(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
