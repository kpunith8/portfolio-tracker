"use server";

export async function refreshPortfolioQuotes() {
  return "cached";
}

export async function refreshDailyHistory() {
  return "complete";
}

export async function refreshHistoricalPrice() {
  return "unavailable";
}
