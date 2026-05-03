import { createHash } from "node:crypto";

import type { SheetRow } from "../types";

export function normalizeRowsForHash(rows: SheetRow[]): string {
  return rows
    .map((row) => `${row.rowNumber}:${row.value.trim()}`)
    .join("\n")
    .trim();
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function buildSourceHash(rows: SheetRow[]): string {
  return sha256(normalizeRowsForHash(rows));
}

