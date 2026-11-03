import "server-only";
import { neon } from "@neondatabase/serverless";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

async function authenticatedSubject() {
  const session = getKindeServerSession();
  if (!(await session.isAuthenticated()))
    throw new Error("Authentication required");
  const user = await session.getUser();
  if (!user?.id) throw new Error("Authentication required");
  return user.id;
}

function database() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured");
  return neon(process.env.DATABASE_URL);
}

export async function findOwnPortfolio() {
  const subject = await authenticatedSubject();
  const sql = database();
  const rows =
    await sql`SELECT id, created_at FROM portfolios WHERE kinde_subject = ${subject}`;
  return rows[0] ?? null;
}

export async function createOwnPortfolio() {
  const subject = await authenticatedSubject();
  const sql = database();
  await sql`INSERT INTO portfolios (kinde_subject) VALUES (${subject}) ON CONFLICT (kinde_subject) DO NOTHING`;
}
