import "server-only";
import { neon } from "@neondatabase/serverless";

export function database(errorMessage = "Database unavailable") {
  if (!process.env.DATABASE_URL) throw new Error(errorMessage);
  return neon(process.env.DATABASE_URL);
}
