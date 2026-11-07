export const PORTFOLIO_PAGE_SIZE = 20;

const MAX_PAGE = 100000;

export function portfolioPage(requested: number) {
  const page =
    Number.isSafeInteger(requested) && requested > 0
      ? Math.min(requested, MAX_PAGE)
      : 1;

  return { page, offset: (page - 1) * PORTFOLIO_PAGE_SIZE };
}

export function portfolioPageCount(total: number) {
  return Math.max(1, Math.ceil(total / PORTFOLIO_PAGE_SIZE));
}
