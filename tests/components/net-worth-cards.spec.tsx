import { test, expect } from "@playwright/experimental-ct-react";
import { NetWorthCards } from "../../src/components/investments/net-worth-cards";

test("shows composition and combined history using recorded investments", async ({
  mount,
  page,
}) => {
  await mount(
    <NetWorthCards
      stocks="100"
      stockHistory={[{ date: "2024-01-02", value: "100" }]}
      manual={{
        assets: [
          {
            id: "debt",
            asset_type: "DEBT_OTHER",
            name: "PPF",
            expense_ratio: null,
          },
        ],
        entries: [
          {
            id: "one",
            instrument_id: "debt",
            entry_type: "PURCHASE",
            date: "2024-01-01",
            quantity: null,
            amount: "50",
            source: "MANUAL",
          },
        ],
        navs: [],
      }}
    />,
  );
  await expect(
    page.getByRole("heading", { name: "Portfolio composition" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Net worth over time" }),
  ).toBeVisible();
  await expect(page.getByText("₹50.00")).toBeVisible();

  const sectors = page.locator(".recharts-pie-sector");

  await sectors.nth(0).dispatchEvent("mouseover");

  const tooltip = page.locator(".recharts-tooltip-wrapper .history-tooltip");

  await expect(tooltip).toBeVisible();

  await expect(tooltip).toHaveCSS("color", "rgb(40, 106, 73)");
  await expect(page.locator(".recharts-tooltip-wrapper").first()).toHaveCSS(
    "transition-duration",
    "0s",
  );
  await sectors.nth(2).dispatchEvent("mouseover");
  await expect(tooltip).toHaveCSS("color", "rgb(130, 96, 61)");
});

test("discloses missing fund NAVs", async ({ mount, page }) => {
  await mount(
    <NetWorthCards
      stocks="100"
      stockHistory={[{ date: "2024-01-02", value: "100" }]}
      manual={{
        assets: [
          {
            id: "fund",
            asset_type: "MUTUAL_FUND",
            name: "Fund",
            expense_ratio: null,
          },
        ],
        entries: [
          {
            id: "one",
            instrument_id: "fund",
            entry_type: "PURCHASE",
            date: "2024-01-01",
            quantity: "2",
            amount: "10",
            source: "MANUAL",
          },
        ],
        navs: [],
      }}
    />,
  );
  await expect(page.getByText(/no usable price or NAV/)).toBeVisible();
  await expect(page.getByText(/history is unavailable/)).toBeVisible();
});
