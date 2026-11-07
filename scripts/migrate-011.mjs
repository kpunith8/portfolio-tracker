import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");

const migration = await readFile(
  new URL("../db/migrations/011_symbol_catalog.sql", import.meta.url),
  "utf8",
);

await neon(process.env.DATABASE_URL).query(migration);
console.log("Migration 011 is applied.");
