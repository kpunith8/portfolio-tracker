import { expect, test } from "@playwright/test";

test("dashboard renders fixture totals and seven-day history", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Portfolio summary")).toContainText("₹2,300.00");
  await expect(
    page.getByRole("heading", { name: "Portfolio value over time" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "7D", exact: true }).click();
  await expect(page.getByLabel("Portfolio value chart")).toBeVisible();
});

test("portfolio sorts holdings and opens a purchase form", async ({ page }) => {
  await page.goto("/dashboard?view=portfolio");

  const holdings = page.locator(".sample-holding summary");

  await expect(holdings).toHaveCount(2);
  await expect(holdings.first()).toContainText("Beta Ltd");
  await page.getByRole("button", { name: /Sort:/ }).click();
  await page
    .getByRole("menuitemradio", { name: "Current asset value" })
    .click();
  await expect(holdings.first()).toContainText("Alpha Ltd");
  await page.getByRole("button", { name: "Record purchase" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save purchase" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("empty portfolio offers a way to record a purchase", async ({ page }) => {
  await page
    .context()
    .addCookies([
      { name: "fixture-empty", value: "1", url: "http://127.0.0.1:3100" },
    ]);
  await page.goto("/dashboard?view=portfolio");
  await expect(
    page.getByRole("heading", { name: "No investments yet" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Record purchase" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Stock ticker or company").fill("TEST");
  await page.getByRole("button", { name: /TEST · NSE/ }).click();
  await page.getByLabel("Quantity").fill("2");
  await page.getByLabel("Purchase price per share").fill("25");

  const today = await page.evaluate(() =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  );

  await expect(page.getByLabel("Purchase date")).toHaveAttribute("max", today);
  await page.getByLabel("Purchase date").fill("2026-11-01");
  await page.getByRole("button", { name: "Save purchase" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("symbol search identifies BSE bonds and formats company names", async ({
  page,
}) => {
  await page.goto("/dashboard?view=portfolio");
  await page.getByRole("button", { name: "Record purchase" }).click();
  await page.getByLabel("Stock ticker or company").fill("BOND");
  await expect(
    page.getByRole("button", { name: "BOND · BSE F Example Bond Limited" }),
  ).toBeVisible();
  await page.getByLabel("Stock ticker or company").fill("ALPHA");
  await expect(
    page.getByRole("button", { name: "ALPHA · BSE Alpha Limited" }),
  ).toBeVisible();
});

test("CSV preview repairs invalid symbols and limits visible rows", async ({
  page,
}) => {
  await page.goto("/dashboard?view=portfolio");
  await page.getByRole("button", { name: "Record purchase" }).click();
  await page.getByRole("tab", { name: "Import .csv" }).click();

  const csv =
    "symbol,exchange,quantity,price,date\n" +
    Array.from(
      { length: 11 },
      (_, i) =>
        `${i === 0 || i === 10 ? "WRONG" : "TEST"},NSE,2,25.50,2026-01-01`,
    ).join("\n");

  await page.getByLabel("Choose CSV file").setInputFiles({
    name: "purchases.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(page.locator(".purchase-table tbody tr")).toHaveCount(6);

  const today = await page.evaluate(() =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  );

  await expect(
    page.getByLabel("date for row 1", { exact: true }),
  ).toHaveAttribute("max", today);
  await expect(
    page.locator(".purchase-table tbody tr").first().locator("td").nth(1),
  ).toContainText("NSE");

  const tableFits = await page
    .locator(".purchase-table-scroll")
    .evaluate((element) => element.scrollWidth <= element.clientWidth);

  expect(tableFits).toBe(true);
  await expect(
    page.getByLabel("Ticker for row 1", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("button", { name: "Add 11 purchases" }),
  ).toBeDisabled();
  await page.getByLabel("Ticker for row 1", { exact: true }).fill("ALPHA");
  await page.getByRole("button", { name: /ALPHA · BSE/ }).click();
  await expect(
    page.getByLabel("Ticker for row 1", { exact: true }),
  ).not.toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("button", { name: "Add 11 purchases" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".purchase-table tbody tr")).toHaveCount(5);
  await page.getByRole("button", { name: "Remove row 11" }).click();
  await expect(
    page.getByRole("button", { name: "Add 10 purchases" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Add 10 purchases" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
