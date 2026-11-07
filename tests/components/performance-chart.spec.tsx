import { expect, test } from "@playwright/experimental-ct-react";
import { PerformanceChart } from "../../src/components/dashboard/performance-chart";

test("chart range changes its accessible summary", async ({ mount, page }) => {
  const history = Array.from({ length: 5 }, (_, index) => ({
    date: `2026-0${index + 1}-01`,
    value: (index + 1) * 100,
    invested: 80,
  }));

  await mount(
    <div style={{ width: 600, height: 300 }}>
      <PerformanceChart history={history} />
    </div>,
  );
  await expect(
    page.getByRole("img", { name: /1Y.*Starts at ₹100.*ends at ₹500/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "3M" }).click();
  await expect(
    page.getByRole("img", { name: /3M.*Starts at ₹200.*ends at ₹500/ }),
  ).toBeVisible();
});
