import "server-only";
import { database } from "../db/database";
import { findDividendMatches, listOwnerDividends } from "./dividend-queries";
import { subject } from "../auth/subject";
import type { DividendRow } from "../../domain/dividends";

export async function readDividends(): Promise<DividendRow[]> {
  const user = await subject();
  const sql = database();
  const rows = await listOwnerDividends(sql, user);

  return rows as DividendRow[];
}

export async function readExistingDividendRows(
  user: string,
  rows: DividendRow[],
): Promise<DividendRow[]> {
  const sql = database();
  const found = await findDividendMatches(sql, user, rows);

  return found as DividendRow[];
}
