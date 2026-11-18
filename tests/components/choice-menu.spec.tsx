import { test, expect } from "@playwright/experimental-ct-react";
import { Example } from "./choice-menu.story";

test("choice menu selects an option and dismisses with Escape or outside click", async ({
  mount,
  page,
}) => {
  await mount(<Example />);

  const summary = page.getByLabel("Example choice");

  await summary.click();
  await page.getByRole("button", { name: "Two" }).click();
  await expect(summary).toHaveText("Two");
  await expect(summary).toBeFocused();
  await summary.click();
  await page.keyboard.press("Escape");
  await expect(summary).toBeFocused();
  await expect(page.getByRole("button", { name: "One" })).toBeHidden();
  await summary.click();
  await page.getByRole("button", { name: "Outside" }).click();
  await expect(page.getByRole("button", { name: "One" })).toBeHidden();
});
