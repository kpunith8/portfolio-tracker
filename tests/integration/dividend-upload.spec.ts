import { test, expect } from "@playwright/test";

test("parses a dividend PDF through the real Next server action", async ({
  page,
}) => {
  await page.goto("/dividend-preview");
  await page
    .getByLabel("Statement")
    .setInputFiles("tests/fixtures/dividend-statement.pdf");
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("status")).toHaveText("Read 1 entries: new");
});

test("checks an existing and conflicting dividend using isolated fixtures", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "fixture-dividend-existing",
      value: "duplicate",
      url: "http://127.0.0.1:3100",
    },
  ]);
  await page.goto("/dividend-preview");
  await page
    .getByLabel("Statement")
    .setInputFiles("tests/fixtures/dividend-statement.pdf");
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Read 1 entries: duplicate",
  );
  await page.context().addCookies([
    {
      name: "fixture-dividend-existing",
      value: "conflict",
      url: "http://127.0.0.1:3100",
    },
  ]);
  await page
    .getByLabel("Statement")
    .setInputFiles("tests/fixtures/dividend-statement.pdf");
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("status")).toHaveText("Read 1 entries: conflict");
});

test("rejects an unreadable PDF through the real action", async ({ page }) => {
  await page.goto("/dividend-preview");
  await page.getByLabel("Statement").setInputFiles({
    name: "invalid.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not a PDF"),
  });
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Could not read this statement",
  );
});
