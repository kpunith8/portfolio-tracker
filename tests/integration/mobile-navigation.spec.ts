import { expect, test } from "@playwright/test";

test("mobile navigation fits and remains keyboard accessible", async ({
  page,
}) => {
  for (const width of [320, 390, 430, 700]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/dashboard?view=portfolio");

    const navigation = page.getByRole("navigation", {
      name: "Main navigation",
    });

    for (const name of [
      "Dashboard",
      "Portfolio",
      "Transactions",
      "Tax report",
      "Settings",
    ]) {
      await expect(
        navigation.getByRole("link", { name, exact: true }),
      ).toBeVisible();
    }

    expect(
      await navigation.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);

    const settings = navigation.getByRole("link", { name: "Settings" });

    await settings.focus();
    await expect(settings).toBeFocused();
    await expect(
      navigation.getByRole("link", { name: "Portfolio" }),
    ).toHaveAttribute("aria-current", "page");
  }
});
