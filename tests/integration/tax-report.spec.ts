import { test, expect } from "@playwright/test";

test("dashboard reports mixed FIFO sale lots and dividend periods", async ({
  page,
}) => {
  await page.goto("/dashboard?view=tax");

  const stockYear = page.locator('.tax-year[data-print-year="2026"]');

  await expect(stockYear.locator(".tax-total")).toContainText("₹10.00");
  await expect(stockYear.locator(".tax-total")).toContainText("₹40.00");
  await stockYear
    .locator("summary")
    .filter({ hasText: "16 Jun – 15 Sep" })
    .click();
  await expect(
    stockYear.getByRole("cell", { name: "Long", exact: true }),
  ).toBeVisible();
  await expect(
    stockYear.getByRole("cell", { name: "Short", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Dividends" }).click();

  const year = page.locator(".dividend-report .tax-year").first();

  await expect(year.locator(".tax-total")).toContainText("₹45.00");
  await year.locator("summary").filter({ hasText: "1 Apr – 15 Jun" }).click();
  await expect(year.getByRole("cell", { name: "2025-06-15" })).toBeVisible();
  await page.getByRole("radio", { name: "Company" }).check();
  await expect(page.getByRole("button", { name: "Export Report" })).toHaveCount(
    0,
  );
  await page
    .locator(".dividend-companies summary")
    .filter({ hasText: "ACME" })
    .click();
  await expect(
    page
      .getByLabel("Dividend entries for Acme Ltd")
      .getByRole("columnheader", { name: "Company" }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Dividend entries for Acme Ltd").getByRole("row"),
  ).toHaveCount(4);
  await expect(
    page
      .locator(".dividend-companies summary")
      .filter({ hasText: "ticker not matched" }),
  ).toBeVisible();
});

test("dividend import checks duplicates before saving a new statement", async ({
  page,
}) => {
  await page.goto("/dashboard?view=tax");
  await page.getByRole("tab", { name: "Dividends" }).click();
  await page.getByRole("button", { name: "Import Dividends" }).click();

  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("Dividend statement PDF").setInputFiles({
    name: "duplicate.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("fixture"),
  });
  await dialog.getByRole("button", { name: "Verify" }).click();
  await expect(
    dialog.getByText("All entries in this statement are already imported."),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
  await dialog.getByLabel("Dividend statement PDF").setInputFiles({
    name: "new.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("fixture"),
  });
  await dialog.getByRole("button", { name: "Verify" }).click();
  await expect(dialog.getByRole("button", { name: "Save" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toContainText(
    "1 new dividend entry saved",
  );
  await expect(
    page.locator(".dividend-report .tax-year").first().locator(".tax-total"),
  ).toContainText("₹65.00");
});

test("empty and incomplete tax data are disclosed", async ({ page }) => {
  await page
    .context()
    .addCookies([
      { name: "fixture-tax-empty", value: "1", url: "http://127.0.0.1:3100" },
    ]);
  await page.goto("/dashboard?view=tax");
  await expect(page.getByText("No stock sales yet")).toBeVisible();
  await page.getByRole("tab", { name: "Mutual funds" }).click();
  await expect(page.getByText("No mutual fund entries found")).toBeVisible();
  await page.getByRole("tab", { name: "Dividends" }).click();
  await expect(page.getByText("No dividends recorded yet")).toBeVisible();
  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: "fixture-tax-incomplete",
      value: "1",
      url: "http://127.0.0.1:3100",
    },
  ]);
  await page.reload();
  await expect(
    page
      .locator(".tax-notice")
      .getByText(/Some sales have incomplete allocations/),
  ).toBeVisible();
});

test("tax report redirects unauthenticated requests", async ({ request }) => {
  const response = await request.get("/dashboard?view=tax", {
    headers: { cookie: "fixture-unauth=1" },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/api/auth/login");
});

test("dividend loading failure can be retried without affecting the stock report", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "fixture-dividend-load-error",
      value: "1",
      url: "http://127.0.0.1:3100",
    },
  ]);
  await page.goto("/dashboard?view=tax");
  await expect(page.locator('.tax-year[data-print-year="2026"]')).toBeVisible();
  await page.getByRole("tab", { name: "Dividends" }).click();
  await expect(
    page.getByText("Could not load dividend records. Please try again."),
  ).toBeVisible();
  await page.context().clearCookies({ name: "fixture-dividend-load-error" });
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(
    page.locator(".dividend-report .tax-year").first().locator(".tax-total"),
  ).toContainText("₹45.00");
});

test("loads dividend history only when the tab is opened", async ({ page }) => {
  await page.context().addCookies([
    {
      name: "fixture-large-dividends",
      value: "1",
      url: "http://127.0.0.1:3100",
    },
  ]);

  const response = await page.goto("/dashboard?view=tax");

  expect(await response!.text()).not.toContain("COMPANY 99");
  await page.getByRole("tab", { name: "Dividends" }).click();
  await expect(
    page.locator(".dividend-report .tax-year").first().locator(".tax-total"),
  ).toContainText("₹2,500.00");
});
