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
  await page.getByLabel("Purchase date").fill("2026-11-01");
  await page.getByRole("button", { name: "Save purchase" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
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
      (_, i) => `${i === 0 ? "WRONG" : "TEST"},NSE,2,25.50,2026-01-01`,
    ).join("\n");

  await page.getByLabel("Choose CSV file").setInputFiles({
    name: "purchases.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(page.locator(".purchase-table tbody tr")).toHaveCount(10);
  await expect(page.getByText("Select a matching symbol")).toBeVisible();
  await page.getByRole("button", { name: "Add 11 purchases" }).click();
  await expect(page.locator(".trade-error[role=alert]")).toContainText("WRONG");
  await page.getByLabel("Ticker for row 1", { exact: true }).fill("ALPHA");
  await page.getByRole("button", { name: /ALPHA · BSE/ }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".purchase-table tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Remove row 11" }).click();
  await page.getByRole("button", { name: "Add 10 purchases" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
