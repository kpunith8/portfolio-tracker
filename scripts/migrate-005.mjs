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
    const migration = await readFile(
      new URL("../db/migrations/005_record_trade.sql", import.meta.url),
      "utf8",
    );

    await sql.transaction([
      sql.query(migration),
      sql`INSERT INTO schema_migrations(version) VALUES ('005_record_trade') ON CONFLICT (version) DO NOTHING`,
    ]);
    console.log("Trade function installed.");
  } catch {
    console.error(
      "Trade function migration failed; check the target database and earlier migrations.",
    );
    process.exitCode = 1;
  }
}
