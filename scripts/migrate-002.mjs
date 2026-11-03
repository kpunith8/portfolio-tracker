import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is missing; configure the intended database first.",
  );
  process.exitCode = 1;
} else {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const migration = await readFile(
      new URL("../db/migrations/002_portfolio_data.sql", import.meta.url),
      "utf8",
    );
    await sql.query(migration);
    console.log("Migration 002 is applied.");
  } catch {
    console.error(
      "Migration 002 failed. Verify the connection, migration 001, and existing schema; no credentials are logged.",
    );
    process.exitCode = 1;
  }
}
