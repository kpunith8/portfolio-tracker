import { expect, test } from "@playwright/experimental-ct-react";
import { PortfolioHistoryChart } from "../../src/components/investments/portfolio-history-chart";

test("renders dated history and changes range", async ({ mount, page }) => {
  const history = Array.from({ length: 7 }, (_, index) => ({
    date: `2026-11-0${index + 1}`,
    value: String(1700 + index * 100),
    alternate: false,
  }));

  await mount(
    <div style={{ width: 800, height: 500 }}>
      <PortfolioHistoryChart history={history} asOf="2026-11-07" />
    </div>,
  );
  await expect(page.getByLabel("Portfolio value chart")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "5D", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".recharts-area-dot")).toHaveCount(6);

  const path = await page.locator(".recharts-area-curve").getAttribute("d");

  expect(path).not.toContain("C");
  await page.getByRole("button", { name: "1M", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "1M", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("shows an empty state when no history exists", async ({ mount, page }) => {
  await mount(<PortfolioHistoryChart history={[]} asOf="2026-11-07" />);
  await expect(page.getByLabel("Portfolio value chart")).toHaveCount(0);
  await expect(
    page.getByText("No complete history available for this period"),
  ).toBeVisible();
});
