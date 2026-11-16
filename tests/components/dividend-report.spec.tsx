import { test, expect } from "@playwright/experimental-ct-react";
import { DividendReport } from "../../src/components/investments/dividend-report";

test("groups dividends by period and company and selects a report year", async ({
  mount,
  page,
}) => {
  const base = {
    company: "ACME INDUSTRIES LTD",
    isin: "INE123A01012",
    shares: "10",
    perShare: "2",
    netAmount: "20",
    symbol: "ACME",
  };

  await mount(
    <DividendReport
      rows={[
        { ...base, exDate: "2025-06-16" },
        { ...base, exDate: "2025-06-15" },
        { ...base, exDate: "2024-05-01" },
      ]}
    />,
  );
  await page.addStyleTag({ path: "src/app/globals.css" });
  await page.addStyleTag({ path: "src/app/dashboard/dashboard.css" });
  await page
    .locator(".tax-period summary")
    .filter({ hasText: "1 Apr – 15 Jun" })
    .first()
    .click();
  await expect(page.getByRole("cell", { name: "2025-06-15" })).toBeVisible();

  const firstPeriod = page
    .locator(".tax-year")
    .first()
    .locator("summary")
    .filter({ hasText: "1 Apr – 15 Jun" });

  await firstPeriod.click();
  await expect(
    page.locator(".tax-year").first().getByRole("cell", { name: "2025-06-15" }),
  ).toHaveCount(0);
  await firstPeriod.click();
  await expect(
    page.locator(".tax-year").first().getByRole("cell", { name: "2025-06-15" }),
  ).toBeVisible();
  await expect(
    page.locator(".tax-year").first().getByText("Acme Industries Ltd").first(),
  ).toBeVisible();
  await page.getByLabel("Company", { exact: true }).check();
  await page.locator(".dividend-companies summary").click();
  await expect(
    page.getByLabel("Dividend entries for Acme Industries Ltd"),
  ).toBeVisible();
  await expect(
    page
      .getByLabel("Dividend entries for Acme Industries Ltd")
      .getByRole("columnheader", { name: "Company" }),
  ).toHaveCount(0);

  const dates = await page
    .locator(".dividend-companies tbody tr td:nth-child(1)")
    .allTextContents();

  expect(dates).toEqual(["2024-05-01", "2025-06-15", "2025-06-16"]);
  await expect(page.getByRole("button", { name: "Export Report" })).toHaveCount(
    0,
  );
  await page.getByRole("radio", { name: "Assessment year" }).check();
  await page.getByRole("button", { name: "Export Report" }).click();
  await page.locator(".tax-year-select summary").click();
  await page.getByRole("button", { name: "AY 2025–26 · FY 2024–25" }).click();
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printedReport =
        document.querySelector(".dividend-print")?.textContent ?? "";
    };
  });
  await page.getByRole("button", { name: "Save Report" }).click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-printed-report",
    /AY 2025–26/,
  );
  await page.evaluate(() => {
    document.body.dataset.dividendPrint = "true";
  });
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".dividend-print")).toContainText(
    "AY 2025–26 · FY 2024–25",
  );
  await expect(page.locator(".dividend-print")).not.toContainText("2025-06-15");
});

test("reviews a statement before saving", async ({ mount, page }) => {
  await mount(<DividendReport rows={[]} />);
  await page.addStyleTag({ path: "src/app/globals.css" });
  await page.addStyleTag({ path: "src/app/dashboard/dashboard.css" });
  await page.getByRole("button", { name: "Import Dividends" }).click();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Verify" })).toBeDisabled();
  await page.getByLabel("Dividend statement PDF").setInputFiles({
    name: "statement.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("test fixture"),
  });
  await expect(page.getByRole("button", { name: "Verify" })).toBeEnabled();
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("Review 1 entry")).toBeVisible();
  await expect(page.getByText("Test Ltd")).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Company", exact: true }),
  ).toBeVisible();

  const overflow = await page
    .locator(".dividend-preview .tax-table-wrap")
    .evaluate((element) => element.scrollWidth > element.clientWidth);

  expect(overflow).toBe(false);
  await expect(
    page.getByText("1 new · 0 already imported · 0 conflicting"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toContainText(
    "1 new dividend entry saved",
  );
});

test("shows an already imported statement without allowing a duplicate save", async ({
  mount,
  page,
}) => {
  await mount(<DividendReport rows={[]} />);
  await page.getByRole("button", { name: "Import Dividends" }).click();
  await page.getByLabel("Dividend statement PDF").setInputFiles({
    name: "duplicate.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("fixture"),
  });
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(
    page.getByText("All entries in this statement are already imported."),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Imported", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
});

test("prevents saving an entry that conflicts with an existing record", async ({
  mount,
  page,
}) => {
  await mount(<DividendReport rows={[]} />);
  await page.getByRole("button", { name: "Import Dividends" }).click();
  await page.getByLabel("Dividend statement PDF").setInputFiles({
    name: "conflict.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("fixture"),
  });
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(
    page.getByText(/same ISIN and ex-date but different values/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
});
