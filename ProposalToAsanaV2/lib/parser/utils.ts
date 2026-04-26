export function toLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function hasKeyword(text: string, keywords: string[]): boolean {
  const t = String(text || "").toLowerCase();
  return keywords.some((k) => t.includes(k.toLowerCase()));
}

export function pushUnique<T>(arr: T[], value: T): void {
  if (!arr.includes(value)) arr.push(value);
}

export function stopAtNotice(lines: string[]): string[] {
  const stopIdx = lines.findIndex((l) =>
    /III\.\s*수급|수급\s*리스트|구매\s*수량|주문\s*수량|신청\s*수량/.test(l)
  );
  return stopIdx >= 0 ? lines.slice(0, stopIdx) : lines;
}

export function getKstDateParts(date: Date): { year: number; month: number; day: number } {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return { year: kst.getUTCFullYear(), month: kst.getUTCMonth() + 1, day: kst.getUTCDate() };
}

export function formatPartsToIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getDueDate(offsetDays: number, now = new Date()): string {
  const d = new Date(now.getTime() + offsetDays * 86400000);
  const { year, month, day } = getKstDateParts(d);
  return formatPartsToIso(year, month, day);
}

export function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return formatPartsToIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function buildSeoulDueAt(isoDate: string, hour: number, minute: number): string {
  return `${isoDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`;
}

export function isValidGid(gid: unknown): boolean {
  return typeof gid === "string" && /^\d{10,}$/.test(gid.trim());
}

/** 공백 정규화 — 필드/옵션 이름 비교에 사용 */
export function normalizeOptionLabel(text: string): string {
  return String(text || "").replace(/\s+/g, " ").trim();
}

export function generateRandomCode(length = 2): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
