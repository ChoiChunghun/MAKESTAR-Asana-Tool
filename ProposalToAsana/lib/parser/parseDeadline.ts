import type { DueFields, DueSummary, NormalizedPlanData } from "@/types/parser";
import { DUE_DAYS_OFFSET } from "./constants";
import { buildSeoulDueAt, formatPartsToIso, getDueDate, getKstDateParts, shiftIsoDate } from "./utils";

export function buildSectionName(data: NormalizedPlanData, productCode: string, now = new Date()): string {
  return `${parseEventStartDate(data, now)} ${productCode}`;
}

export function parseEventStartDate(data: NormalizedPlanData, now = new Date()): string {
  for (let index = 0; index < data.lines.length; index += 1) {
    const line = data.lines[index];
    if (!/(응모.*기간|응모기간|시작일)/.test(line)) continue;
    const dates = extractIsoDatesFromText(line, now);
    if (dates.length) return toMonthDay(dates[0]);

    for (let offset = 1; offset <= 4; offset += 1) {
      const targetLine = data.lines[index + offset];
      if (!targetLine) break;
      const nextLineDates = extractIsoDatesFromText(targetLine, now);
      if (nextLineDates.length) return toMonthDay(nextLineDates[0]);
    }
  }

  const { month, day } = getKstDateParts(now);
  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

export function parseApplicationDeadlineIsoDate(data: NormalizedPlanData, now = new Date()): string | null {
  const blockDeadline = findDeadlineFromEventApplicationPeriodBlock(data.lines, now);
  if (blockDeadline) return blockDeadline;

  const patterns = [
    /(응모.*(?:마감|종료)|(?:마감|종료).*(?:응모|신청))/i,
    /(응모.*기간|응모기간)/i,
    /(마감일|종료일)/i
  ];

  for (const pattern of patterns) {
    const deadline = findLastIsoDateInMatchingLines(data.lines, pattern, now);
    if (deadline) return deadline;
  }

  return null;
}

export function getTaskDueFields(data: NormalizedPlanData, taskGroup: "open" | "update" | "md" | "vmd", now = new Date()): DueFields {
  const deadlineIso = parseApplicationDeadlineIsoDate(data, now);

  if (!deadlineIso) {
    return { due_on: getDueDate(DUE_DAYS_OFFSET, now) };
  }

  if (taskGroup === "open") {
    return { due_at: buildSeoulDueAt(deadlineIso, 13, 0) };
  }

  if (taskGroup === "update") {
    return { due_on: shiftIsoDate(deadlineIso, -1) };
  }

  return { due_on: deadlineIso };
}

export function buildDueSummary(data: NormalizedPlanData, now = new Date()): DueSummary {
  const deadlineIso = parseApplicationDeadlineIsoDate(data, now);
  const open = getTaskDueFields(data, "open", now);
  const md = getTaskDueFields(data, "md", now);
  const update = getTaskDueFields(data, "update", now);
  const vmd = getTaskDueFields(data, "vmd", now);
  const winner = { due_on: getDueDate(DUE_DAYS_OFFSET, now) };
  const lines = [];

  if (deadlineIso) {
    lines.push(`- 응모 마감일: ${deadlineIso}`);
  } else {
    lines.push("- 응모 마감일: 찾지 못함");
    lines.push(`- 기본 폴백: 오늘 기준 +${DUE_DAYS_OFFSET}일`);
  }

  lines.push(`- 오픈(상위/하위): ${formatDueFieldsForDisplay(open)}`);
  lines.push(`- MD(상위/하위): ${formatDueFieldsForDisplay(md)}`);
  lines.push(`- 업데이트(상위/하위): ${formatDueFieldsForDisplay(update)}`);
  lines.push(`- VMD(상위/하위): ${formatDueFieldsForDisplay(vmd)}`);
  lines.push(`- 당첨자 선정: ${formatDueFieldsForDisplay(winner)}`);

  return {
    deadlineIso,
    open,
    md,
    update,
    vmd,
    winner,
    text: lines.join("\n")
  };
}

export function formatDueFieldsForDisplay(dueFields: DueFields): string {
  if (dueFields.due_at) {
    return String(dueFields.due_at).replace("T", " ").replace(":00+09:00", " KST");
  }
  if (dueFields.due_on) return String(dueFields.due_on);
  return "(없음)";
}

export function extractIsoDatesFromText(text: string, now = new Date()): string[] {
  const matches: string[] = [];
  const normalizedText = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalizedText) return matches;

  const fullYearRegex = /(\d{4})[.\-\/년]\s*(\d{1,2})[.\-\/월]\s*(\d{1,2})(?:일)?/g;
  const shortYearRegex = /(\d{2})[.\-\/]\s*(\d{1,2})[.\-\/]\s*(\d{1,2})/g;
  const monthDayRegex = /(^|[^\d.\-\/])(\d{1,2})[.\-\/월]\s*(\d{1,2})(?:일)?/g;

  for (const match of normalizedText.matchAll(fullYearRegex)) {
    addDate(matches, Number(match[1]), Number(match[2]), Number(match[3]));
  }

  for (const match of normalizedText.matchAll(shortYearRegex)) {
    addDate(matches, 2000 + Number(match[1]), Number(match[2]), Number(match[3]));
  }

  const { year: currentYear } = getKstDateParts(now);
  for (const match of normalizedText.matchAll(monthDayRegex)) {
    addDate(matches, currentYear, Number(match[2]), Number(match[3]));
  }

  return dedupeIsoDates(matches);
}

function findDeadlineFromEventApplicationPeriodBlock(lines: string[], now: Date): string | null {
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const cellText = normalizeDeadlineLabelText(lines[lineIndex]);
    if (!cellText.includes("이벤트응모기간")) continue;

    for (let offset = 1; offset <= 4; offset += 1) {
      const targetLineIndex = lineIndex + offset;
      if (targetLineIndex >= lines.length) break;

      const rowDates = extractIsoDatesFromText(lines[targetLineIndex], now);
      if (rowDates.length) return rowDates[rowDates.length - 1];
    }

    const sameLineDates = extractIsoDatesFromText(lines[lineIndex], now);
    if (sameLineDates.length) return sameLineDates[sameLineDates.length - 1];
  }

  return null;
}

function normalizeDeadlineLabelText(text: string): string {
  return String(text || "").replace(/\s+/g, "").trim();
}

function findLastIsoDateInMatchingLines(lines: string[], pattern: RegExp, now: Date): string | null {
  for (const line of lines) {
    if (!line || !pattern.test(line)) continue;

    const dates = extractIsoDatesFromText(line, now);
    if (dates.length) return dates[dates.length - 1];
  }
  return null;
}

function addDate(matches: string[], year: number, month: number, day: number): void {
  if (!isValidDateParts(year, month, day)) return;
  matches.push(formatPartsToIso(year, month, day));
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function dedupeIsoDates(dates: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of dates) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function toMonthDay(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${month}/${day}`;
}
