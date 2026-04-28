export function pushUnique<T>(arr: T[], value: T): void {
  if (!arr.includes(value)) arr.push(value);
}

export function escapeRegExp(text: string): string {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function hasKeyword(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

export function normalizeOptionLabel(text: string): string {
  return String(text || "").replace(/\s+/g, " ").trim();
}

export function toLines(text: string): string[] {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function stopAtNotice(lines: string[]): string[] {
  const stopIndex = lines.findIndex((line) => line.includes("유의사항"));
  return stopIndex >= 0 ? lines.slice(0, stopIndex) : lines;
}

export function getKstDateParts(now = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day)
  };
}

export function formatPartsToIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getTodayIsoInKst(now = new Date()): string {
  const { year, month, day } = getKstDateParts(now);
  return formatPartsToIso(year, month, day);
}

export function shiftIsoDate(isoDate: string, days: number): string {
  const parts = String(isoDate || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return getDueDate(days);
  }
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  date.setUTCDate(date.getUTCDate() + days);
  return formatPartsToIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function getDueDate(days: number, now = new Date()): string {
  const today = getTodayIsoInKst(now);
  return shiftIsoDate(today, days);
}

export function buildSeoulDueAt(isoDate: string, hour: number, minute: number): string {
  return `${isoDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`;
}

export function isValidGid(value: unknown): boolean {
  return /^\d+$/.test(String(value || ""));
}
