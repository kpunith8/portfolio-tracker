import { test, expect } from "@playwright/experimental-ct-react";
import { TaxReport } from "../../src/components/investments/tax-report";

test("shows FIFO lots and allows choosing an assessment year for export", async ({
  mount,
  page,
}) => {
  await mount(
    <TaxReport
      incomplete={false}
      hasMutualFundPurchases={false}
      lots={[
        {
          sellId: "one",
          symbol: "ABC",
          sellDate: "2025-05-02",
          buyDate: "2024-05-01",
          quantity: "1",
          buyPrice: "100",
          sellPrice: "120",
        },
        {
          sellId: "two",
          symbol: "XYZ",
          sellDate: "2026-05-02",
          buyDate: "2025-01-01",
          quantity: "1",
          buyPrice: "100",
          sellPrice: "120",
        },
        {
          sellId: "one",
          symbol: "ABC",
          sellDate: "2025-05-02",
          buyDate: "2025-01-01",
          quantity: "2",
          buyPrice: "110",
          sellPrice: "120",
        },
      ]}
    />,
  );
  await page.addStyleTag({ path: "src/app/globals.css" });
  await page.addStyleTag({ path: "src/app/dashboard/dashboard.css" });
  await expect(page.getByText("View details")).toHaveCount(10);
  await page
    .locator('.tax-year[data-print-year="2026"] summary')
    .filter({ hasText: "1 Apr – 15 Jun" })
    .click();
  await expect(
    page.getByRole("cell", { name: "Long", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Short", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("ABC total")).toBeVisible();

  const period = page
    .locator('.tax-year[data-print-year="2026"] summary')
    .filter({ hasText: "1 Apr – 15 Jun" });

  await period.click();
  await expect(
    page.locator('.tax-year[data-print-year="2026"]').getByText("ABC total"),
  ).toHaveCount(0);
  await period.click();
  await expect(
    page.locator('.tax-year[data-print-year="2026"]').getByText("ABC total"),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Sold on" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Bought on" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "1.00", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Export Report" }).click();

  const yearPicker = page.locator(".tax-year-select summary");

  await expect(yearPicker).toContainText("AY 2027–28 · FY 2026–27");
  await expect(page.getByRole("button", { name: "Save Report" })).toBeVisible();
  await yearPicker.focus();
  await page.keyboard.press("Enter");

  const oldYear = page.getByRole("button", { name: "AY 2026–27 · FY 2025–26" });

  await expect(oldYear).toBeVisible();
  await oldYear.click();
  await expect(yearPicker).toContainText("AY 2026–27 · FY 2025–26");
  await expect(yearPicker).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(yearPicker).toBeFocused();
  await expect(page.locator(".tax-year-select")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printedYear = document.body.dataset.taxPrintYear;
    };
  });
  await page.getByRole("button", { name: "Save Report" }).click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-printed-year",
    "2026",
  );
  await page.evaluate(() => {
    document.body.dataset.taxPrintYear = "2026";
  });
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".tax-print-report")).toBeVisible();
  await expect(page.locator(".tax-year")).toHaveCount(2);
  await expect(page.locator(".tax-year").first()).toBeHidden();
  await expect(page.locator(".tax-print-report")).toContainText(
    "AY 2026–27 · FY 2025–26",
  );
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => {
    delete document.body.dataset.taxPrintYear;
  });
  await page.getByRole("tab", { name: "Dividends" }).click();
  await expect(page.getByText("No dividends recorded yet")).toBeVisible();
});

test("mutual fund tab explains missing entries or sales without using stock results", async ({
  mount,
  page,
}) => {
  const component = await mount(
    <TaxReport lots={[]} incomplete={false} hasMutualFundPurchases={false} />,
  );

  await page.getByRole("tab", { name: "Mutual funds" }).click();
  await expect(page.getByText("No mutual fund entries found")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export Report" })).toHaveCount(
    0,
  );
  await component.update(
    <TaxReport lots={[]} incomplete={false} hasMutualFundPurchases={true} />,
  );
  await expect(
    page.getByText("No mutual fund sale records found"),
  ).toBeVisible();
  await expect(
    page.getByText(/Mutual fund sales and redemptions cannot yet be recorded/),
  ).toBeVisible();
});
