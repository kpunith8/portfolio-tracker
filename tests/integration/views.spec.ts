import { expect, test } from "@playwright/test";

test("landing page navigates to overview", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "Explore the overview" })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Everything in its place." }),
  ).toBeVisible();
});

test("transactions show the user's trades and navigate to portfolio", async ({
  page,
}) => {
  await page.goto("/dashboard?view=transactions");

  const table = page.getByLabel("Scrollable transaction table");

  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table).toContainText("ALPHA");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Portfolio" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your investments" }),
  ).toBeVisible();
});

test("purchase lot offers sale and deletion confirmation", async ({ page }) => {
  await page.goto("/dashboard?view=portfolio");

  const holding = page
    .locator(".holding-entry")
    .filter({ hasText: "Alpha Ltd" });

  await holding.locator("summary").click();
  await holding.getByRole("button", { name: "Record sale" }).click();
  await expect(
    page.getByRole("heading", { name: "Record a sale" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await holding.getByRole("button", { name: /Delete purchase/ }).click();
  await expect(page.getByRole("dialog")).toContainText(/cannot be undone/i);
  await page.getByRole("button", { name: "Cancel" }).click();
  await holding.getByRole("link", { name: /View details/ }).click();
  await expect(page.getByRole("heading", { name: "Alpha Ltd" })).toBeVisible();
});

test("live market sorts holdings and falls back when stream fails", async ({
  page,
}) => {
  await page.route("**/api/fyers/stream", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.goto("/dashboard?view=portfolio&tab=live");

  const rows = page.getByLabel("Scrollable market table").getByRole("row");

  await expect(page.getByRole("status")).toContainText("unavailable");
  await expect(rows).toHaveCount(3);
  await page.getByRole("button", { name: "Company" }).click();
  await expect(rows.nth(1)).toContainText("Alpha Ltd");
  await page.getByRole("button", { name: "Company" }).click();
  await expect(rows.nth(1)).toContainText("Beta Ltd");
});

test("settings exposes FYERS reconnect for the owner", async ({ page }) => {
  await page.goto("/dashboard?view=settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Connect FYERS" }),
  ).toHaveAttribute("href", "/api/fyers/connect");
});

test("dashboard redirects when the mocked session is unauthenticated", async ({
  request,
}) => {
  const response = await request.get("/dashboard", {
    headers: { cookie: "fixture-unauth=1" },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/api/auth/login");
});

test("dashboard displays the unavailable state when data access fails", async ({
  page,
}) => {
  await page
    .context()
    .addCookies([
      { name: "fixture-db-error", value: "1", url: "http://127.0.0.1:3100" },
    ]);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Portfolio unavailable" }),
  ).toBeVisible();
});

test("live market applies streamed prices and previous closes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class FakeEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        setTimeout(() => {
          for (const tick of [
            {
              symbol: "NSE:ALPHA-EQ",
              price: "110",
              previousClose: "90",
              marketDate: "2026-11-07",
              tradedAt: 1794000000,
            },
            {
              symbol: "NSE:BETA-EQ",
              price: "60",
              previousClose: "50",
              marketDate: "2026-11-07",
              tradedAt: 1794000000,
            },
          ])
            this.onmessage?.(
              new MessageEvent("message", { data: JSON.stringify({ tick }) }),
            );
        }, 100);
      }
      close() {}
    }

    window.EventSource = FakeEventSource as unknown as typeof EventSource;
  });
  await page.goto("/dashboard?view=portfolio&tab=live");
  await expect(page.getByLabel("Market summary")).toContainText("₹2,500.00");
  await expect(page.getByLabel("Market summary")).toContainText("₹450.00");
});

test("tax report displays its planned-state page", async ({ page }) => {
  await page.goto("/dashboard?view=tax");
  await expect(page.getByRole("heading", { name: "Tax report" })).toBeVisible();
  await expect(page.getByText("This section is coming soon.")).toBeVisible();
});
