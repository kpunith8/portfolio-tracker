import { ManualTransactions } from "../../src/components/investments/manual-transactions";
import { ManualAssetEntry } from "../../src/components/investments/manual-asset-entry";
import { test, expect } from "@playwright/experimental-ct-react";
import {
  ManualAssets,
  ManualAssetsUnavailable,
  type ManualAssetData,
} from "../../src/components/investments/manual-assets";

const data: ManualAssetData = {
  assets: [
    {
      id: "fund",
      asset_type: "MUTUAL_FUND",
      name: "Example fund",
      expense_ratio: "0.5000",
    },
    { id: "debt", asset_type: "DEBT_OTHER", name: "PPF", expense_ratio: null },
  ],
  entries: [
    {
      id: "purchase",
      instrument_id: "fund",
      entry_type: "PURCHASE",
      date: "2023-01-01",
      quantity: "2.5",
      amount: "100",
      source: "MANUAL",
    },
    {
      id: "deposit",
      instrument_id: "debt",
      entry_type: "PURCHASE",
      date: "2023-01-01",
      quantity: null,
      amount: "500",
      source: "MANUAL",
    },
    {
      id: "deposit-two",
      instrument_id: "debt",
      entry_type: "PURCHASE",
      date: "2024-01-01",
      quantity: null,
      amount: "300",
      source: "MANUAL",
    },
    {
      id: "interest",
      instrument_id: "debt",
      entry_type: "INTEREST",
      date: "2024-03-31",
      quantity: null,
      amount: "20",
      source: "MANUAL",
    },
  ],
  navs: [{ instrument_id: "fund", date: "2024-01-01", price: "120" }],
};

test("fund details show dated valuation and purchase returns", async ({
  mount,
  page,
}) => {
  const component = await mount(
    <ManualAssets data={data} type="MUTUAL_FUND" />,
  );

  await expect(page.getByText("Expense ratio: 0.5000%")).toBeVisible();
  await component.update(
    <ManualAssets data={data} type="MUTUAL_FUND" detailId="fund" />,
  );
  await expect(page.getByText("Investment XIRR")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "CAGR" })).toBeVisible();
  await expect(
    page.getByText("2024-01-01", { exact: false }).first(),
  ).toBeVisible();
});

test("debt row records interest and details retain its date", async ({
  mount,
  page,
}) => {
  const component = await mount(<ManualAssets data={data} type="DEBT_OTHER" />);

  await page.locator("summary").click();

  const purchases = page.getByRole("table", { name: "Investments in PPF" });

  await expect(purchases.getByRole("cell", { name: "₹500.00" })).toBeVisible();
  await expect(purchases.getByRole("cell", { name: "₹300.00" })).toBeVisible();
  await page
    .getByRole("button", {
      name: "Record interest for PPF purchase on 2023-01-01",
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Delete PPF purchase on 2023-01-01" }),
  ).toBeVisible();
  await expect(page.getByText(/Earlier interest credits/)).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Interest credited")).toBeVisible();
  await expect(page.getByLabel("Credit date")).toBeVisible();
  await component.update(
    <ManualAssets data={data} type="DEBT_OTHER" detailId="debt" />,
  );
  await expect(page.getByRole("cell", { name: "2024-03-31" })).toBeVisible();
  await expect(page.getByText("₹20.00")).toBeVisible();
});

test("mutual fund CSV can be reviewed and edited before import", async ({
  mount,
  page,
}) => {
  await mount(
    <ManualAssetEntry
      type="MUTUAL_FUND"
      close={() => {}}
      onPendingChange={() => {}}
    />,
  );
  await page.getByRole("tab", { name: "Import .csv" }).click();
  await page.getByLabel("Choose CSV file").setInputFiles({
    name: "funds.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "name,date,quantity,price,expense_ratio\nExample fund,2024-01-01,1.5,100,0.5\nSecond fund,2024-02-01,2,105,\n",
    ),
  });
  await expect(page.getByLabel("name for row 1")).toHaveValue("Example fund");
  await page.getByRole("button", { name: "Remove row 2" }).click();
  await expect(
    page.getByRole("button", { name: "Add 1 purchases" }),
  ).toBeEnabled();
});

test("debt entry offers the three investment types", async ({
  mount,
  page,
}) => {
  await mount(
    <ManualAssetEntry
      type="DEBT_OTHER"
      close={() => {}}
      onPendingChange={() => {}}
    />,
  );

  const select = page.getByLabel("Investment name");

  await select.click();
  for (const name of ["Sukanya Yojane", "PPF", "FD"])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "FD", exact: true }).click();
  await expect(select).toContainText("FD");
  await expect(page.getByLabel("Units")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save purchase" }),
  ).toBeDisabled();
});

test("manual asset empty and unavailable states identify the selected tab", async ({
  mount,
  page,
}) => {
  const empty = { assets: [], entries: [], navs: [] };
  const component = await mount(
    <ManualAssets data={empty} type="MUTUAL_FUND" />,
  );

  await expect(
    page.getByRole("heading", { name: "No mutual funds yet" }),
  ).toBeVisible();
  await component.update(<ManualAssets data={empty} type="DEBT_OTHER" />);
  await expect(
    page.getByRole("heading", { name: "No debt investments yet" }),
  ).toBeVisible();
  await component.update(<ManualAssetsUnavailable type="MUTUAL_FUND" />);
  await expect(
    page.getByRole("heading", { name: "Mutual funds unavailable" }),
  ).toBeVisible();
  await component.update(<ManualAssetsUnavailable type="DEBT_OTHER" />);
  await expect(
    page.getByRole("heading", { name: "Debt investments unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByText("Check the database connection and migration status."),
  ).toBeVisible();
});

test("transaction lists show matching fund purchases and dated debt interest", async ({
  mount,
  page,
}) => {
  const component = await mount(
    <ManualTransactions data={data} type="MUTUAL_FUND" />,
  );

  await expect(page.getByRole("cell", { name: "Example fund" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "₹250.00" })).toBeVisible();
  await expect(page.getByText("PPF")).toHaveCount(0);
  await component.update(<ManualTransactions data={data} type="DEBT_OTHER" />);
  await expect(page.getByRole("cell", { name: "Interest credit" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("cell", { name: "₹20.00" })).toHaveCount(0);
  await expect(page.getByText("Example fund")).toHaveCount(0);
});

test("manual transaction pages show empty state and paginate", async ({
  mount,
  page,
}) => {
  const empty = { assets: [], entries: [], navs: [] };
  const component = await mount(
    <ManualTransactions data={empty} type="MUTUAL_FUND" />,
  );

  await expect(
    page.getByRole("heading", { name: "No mutual fund transactions yet" }),
  ).toBeVisible();

  const entries = Array.from({ length: 21 }, (_, i) => ({
    ...data.entries[1],
    id: String(i),
    amount: String(i + 1),
  }));

  await component.update(
    <ManualTransactions data={{ ...data, entries }} type="DEBT_OTHER" />,
  );
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByRole("cell", { name: "₹21.00" })).toBeVisible();
});

test("removed debt purchase disappears from transaction list", async ({
  mount,
  page,
}) => {
  const component = await mount(
    <ManualTransactions data={data} type="DEBT_OTHER" />,
  );

  await expect(page.getByRole("cell", { name: "₹500.00" })).toBeVisible();
  await component.update(
    <ManualTransactions
      data={{
        ...data,
        entries: data.entries.filter((entry) => entry.id !== "deposit"),
      }}
      type="DEBT_OTHER"
    />,
  );
  await expect(page.getByRole("cell", { name: "₹500.00" })).toHaveCount(0);
});
