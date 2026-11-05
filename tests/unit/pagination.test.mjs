import test from "node:test";
import assert from "node:assert/strict";
import {
  portfolioPage,
  portfolioPageCount,
  PORTFOLIO_PAGE_SIZE,
} from "../../src/domain/pagination.ts";

test("normalizes requested pages and calculates the matching offset", () => {
  assert.deepEqual(portfolioPage(1), { page: 1, offset: 0 });
  assert.deepEqual(portfolioPage(3), { page: 3, offset: 40 });
  assert.deepEqual(portfolioPage(100001), { page: 100000, offset: 1999980 });
  for (const page of [0, -1, 1.5, NaN, Infinity])
    assert.deepEqual(portfolioPage(page), { page: 1, offset: 0 });
});

test("page count includes an empty first page and rounds partial pages up", () => {
  assert.equal(PORTFOLIO_PAGE_SIZE, 20);
  assert.equal(portfolioPageCount(0), 1);
  assert.equal(portfolioPageCount(20), 1);
  assert.equal(portfolioPageCount(21), 2);
});
