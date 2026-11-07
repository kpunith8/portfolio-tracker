import { test, expect } from "@playwright/experimental-ct-react";
import { TableHeader, TableScroll } from "../../src/components/ui/table";

test("table headings and scroll area remain accessible", async ({
  mount,
  page,
}) => {
  await mount(
    <TableScroll label="Investments" className="table-scroll">
      <table>
        <TableHeader columns={["Company", "Value"]} />
        <tbody>
          <tr>
            <td>Acme</td>
            <td>100</td>
          </tr>
        </tbody>
      </table>
    </TableScroll>,
  );

  await expect(
    page.getByRole("columnheader", { name: "Company" }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "Acme" })).toBeVisible();
  await page.getByLabel("Investments").focus();
  await expect(page.getByLabel("Investments")).toBeFocused();
});
