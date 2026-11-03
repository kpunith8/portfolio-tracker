import test from "node:test";
import assert from "node:assert/strict";
import { displayCompanyName } from "../../src/domain/company-name.ts";
test("formats uppercase company names without changing common abbreviations", () => {
  assert.equal(
    displayCompanyName("FIEM INDUSTRIES LIMITED"),
    "Fiem Industries Limited",
  );
  assert.equal(displayCompanyName("JSW ENERGY LIMITED"), "JSW Energy Limited");
  assert.equal(
    displayCompanyName("GROWW NIFTY EV & NEW AGE AUTOMOTIVE ETF"),
    "Groww Nifty EV & New Age Automotive ETF",
  );
  assert.equal(displayCompanyName("BANK OF INDIA"), "Bank of India");
});
test("keeps existing mixed-case names intact", () => {
  assert.equal(displayCompanyName("iShares India ETF"), "iShares India ETF");
  assert.equal(displayCompanyName(""), "");
});
