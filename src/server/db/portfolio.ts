import "server-only";
import { database } from "./database";
import { subject } from "../auth/subject";

export async function findOwnPortfolio() {
  const user = await subject();
  const sql = database("Database is not configured");
  const rows =
    await sql`SELECT id, created_at FROM portfolios WHERE kinde_subject = ${user}`;
  return rows[0] ?? null;
}

export async function createOwnPortfolio() {
  const user = await subject();
  const sql = database("Database is not configured");
  await sql`INSERT INTO portfolios (kinde_subject) VALUES (${user}) ON CONFLICT (kinde_subject) DO NOTHING`;
}
