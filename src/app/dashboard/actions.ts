"use server";
import { redirect } from "next/navigation";
import { createOwnPortfolio } from "../../server/db/portfolio";
export async function createPortfolio() {
  await createOwnPortfolio();
  redirect("/dashboard?view=portfolio");
}
