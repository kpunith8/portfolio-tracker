import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing.");
  process.exitCode = 1;
} else {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const test = await readFile(
      new URL("../tests/db/portfolio_schema.sql", import.meta.url),
      "utf8",
    );
    await sql.query(test);
    console.log("Portfolio schema constraints passed; test fixtures removed.");
  } catch {
    console.error(
      "Portfolio schema test failed. Check the target database and migration status.",
    );
    process.exitCode = 1;
  }
}
