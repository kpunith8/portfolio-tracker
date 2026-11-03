import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is missing. Configure a development database before running this migration.",
  );
  process.exitCode = 1;
} else {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const migration = await readFile(
      new URL("../db/migrations/001_create_portfolios.sql", import.meta.url),
      "utf8",
    );
    await sql.query(migration);
    console.log("Migration 001 applied: portfolios table created.");
  } catch {
    console.error(
      "Migration 001 failed. Check the database connection and whether the portfolios table already exists. No connection details are logged.",
    );
    process.exitCode = 1;
  }
}
