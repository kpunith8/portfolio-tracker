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
  await page.getByLabel("NSE ticker symbol").fill("TEST");
  await page.getByLabel("Quantity").fill("2");
  await page.getByLabel("Purchase price per share").fill("25");
  await page.getByLabel("Purchase date").fill("2026-11-01");
  await page.getByRole("button", { name: "Save purchase" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
