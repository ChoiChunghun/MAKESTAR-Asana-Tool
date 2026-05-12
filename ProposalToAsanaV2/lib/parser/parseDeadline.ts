import type { DueFields, DueSummary, NormalizedPlanData } from "@/types/parser";
import { DUE_DAYS_OFFSET } from "./constants";
import { buildSeoulDueAt, formatPartsToIso, getDueDate, getKstDateParts, shiftIsoDate } from "./utils";
import { extractIsoDatesFromText } from "./parseOverview";

// ── 섹션명용 "응모 시작일" 추출 ────────────────────────────────────────────

export function buildSectionName(data: NormalizedPlanData, productCode: string, now = new Date()): string {
  return `${parseEventStartDate(data, now)} ${productCode}`;
}

export function parseEventStartDate(data: NormalizedPlanData, now = new Date()): string {
  // ① 개요 테이블에서 파싱된 값 우선 사용
  if (data.applicationStartIso) return toMonthDay(data.applicationStartIso);

  // ② fallback: 문서 전체에서 응모기간/판매기간 행 탐색
  for (let i = 0; i < data.lines.length; i++) {
    const line = data.lines[i];
    if (!/(응모.*기간|응모기간|판매.*기간|판매기간|시작일)/.test(line)) continue;
    const dates = extractIsoDatesFromText(line, now);
    if (dates.length) return toMonthDay(dates[0]);
    for (let offset = 1; offset <= 4; offset++) {
      const next = data.lines[i + offset];
      if (!next) break;
      const nd = extractIsoDatesFromText(next, now);
      if (nd.length) return toMonthDay(nd[0]);
    }
  }
  const { month, day } = getKstDateParts(now);
  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

// ── 응모 종료일 (태스크 마감일 계산 기준) ─────────────────────────────────

export function parseApplicationDeadlineIso(data: NormalizedPlanData, now = new Date()): string | null {
  // ① 개요 테이블에서 파싱된 응모 종료일 우선 사용
  if (data.applicationEndIso) return data.applicationEndIso;

  // ② fallback: 문서 탐색
  const block = findDeadlineFromBlock(data.lines, now);
  if (block) return block;

  const patterns = [
    /(응모.*(?:마감|종료)|(?:마감|종료).*(?:응모|신청))/i,
    /(응모.*기간|응모기간)/i,
    /(판매.*기간|판매기간)/i,
    /(마감일|종료일)/i
  ];
  for (const pattern of patterns) {
    const result = findLastDateInMatchingLines(data.lines, pattern, now);
    if (result) return result;
  }
  return null;
}

// ── 태스크별 마감일 계산 ───────────────────────────────────────────────────

export function getTaskDueFields(
  data: NormalizedPlanData,
  taskGroup: "open" | "update" | "md" | "vmd",
  now = new Date()
): DueFields {
  // 오픈 태스크: 응모 시작일 13:00 (없으면 응모 종료일 13:00 → 없으면 폴백)
  if (taskGroup === "open") {
    const startIso = data.applicationStartIso;
    if (startIso) return { due_at: buildSeoulDueAt(startIso, 13, 0) };
    const deadlineIso = parseApplicationDeadlineIso(data, now);
    if (deadlineIso) return { due_at: buildSeoulDueAt(deadlineIso, 13, 0) };
    return { due_on: getDueDate(DUE_DAYS_OFFSET, now) };
  }

  const iso = parseApplicationDeadlineIso(data, now);
  if (!iso) return { due_on: getDueDate(DUE_DAYS_OFFSET, now) };
  if (taskGroup === "update") return { due_on: shiftIsoDate(iso, -1) };
  return { due_on: iso };
}

export function getWinnerDueFields(data: NormalizedPlanData, now = new Date()): DueFields {
  const iso = data.winnerAnnouncementIso || findWinnerAnnouncementInLines(data.lines, now);
  if (iso) return { due_on: iso };
  return { due_on: getDueDate(DUE_DAYS_OFFSET, now) };
}

// ── 요약 생성 ─────────────────────────────────────────────────────────────

export function buildDueSummary(data: NormalizedPlanData, now = new Date()): DueSummary {
  const deadlineIso = parseApplicationDeadlineIso(data, now);
  // winnerAnnouncementIso: 개요 파서 결과 → 전체 행 fallback 탐색 순
  const winnerAnnouncementIso =
    data.winnerAnnouncementIso || findWinnerAnnouncementInLines(data.lines, now) || null;
  const open = getTaskDueFields(data, "open", now);
  const md = getTaskDueFields(data, "md", now);
  const update = getTaskDueFields(data, "update", now);
  const vmd = getTaskDueFields(data, "vmd", now);
  const winner = getWinnerDueFields(data, now);

  // ── 실제 이벤트 날짜 ─────────────────────────────────────────────────────
  const eventLines: string[] = [];
  if (data.applicationStartIso) {
    eventLines.push(`- 응모 시작일: ${formatIso(data.applicationStartIso)}`);
  }
  eventLines.push(
    deadlineIso
      ? `- 응모 종료일: ${formatIso(deadlineIso)}`
      : "- 응모 종료일: 찾지 못함"
  );
  if (winnerAnnouncementIso) {
    eventLines.push(`- 당첨자 발표일: ${formatIso(winnerAnnouncementIso)}`);
  }

  // ── 태스크 마감일 ─────────────────────────────────────────────────────────
  const taskLines: string[] = [
    `- 오픈 (응모 시작일 13:00): ${formatDue(open)}`,
    `- MD: ${formatDue(md)}`,
    `- 업데이트: ${formatDue(update)}`,
    `- VMD: ${formatDue(vmd)}`,
    `- 당첨자 선정: ${formatDue(winner)}`,
  ];

  const allLines = [...eventLines, ...taskLines];

  return {
    deadlineIso,
    winnerAnnouncementIso,
    open, md, update, vmd, winner,
    text: allLines.join("\n"),
    eventDatesText: eventLines.join("\n"),
    taskDatesText: taskLines.join("\n"),
  };
}

// ── 내부 유틸 ─────────────────────────────────────────────────────────────

/** ISO → YYYY.MM.DD 또는 YYYY.MM.DD HH:MM KST */
function formatIso(iso: string | null | undefined): string {
  if (!iso) return "(없음)";
  const dateStr = iso.slice(0, 10).replace(/-/g, ".");
  // datetime (T 포함) 인 경우 시간 추출
  if (iso.length > 10 && iso[10] === "T") {
    const time = iso.slice(11, 16);
    return `${dateStr} ${time} KST`;
  }
  return dateStr;
}

function formatDue(f: DueFields): string {
  if (f.due_at) return formatIso(String(f.due_at));
  if (f.due_on) return formatIso(String(f.due_on));
  return "(없음)";
}

function findDeadlineFromBlock(lines: string[], now: Date): string | null {
  for (let i = 0; i < lines.length; i++) {
    const norm = lines[i].replace(/\s+/g, "");
    if (!norm.includes("이벤트응모기간") && !norm.includes("판매기간")) continue;
    for (let offset = 1; offset <= 4; offset++) {
      if (i + offset >= lines.length) break;
      const dates = extractIsoDatesFromText(lines[i + offset], now);
      if (dates.length) return dates[dates.length - 1];
    }
    const same = extractIsoDatesFromText(lines[i], now);
    if (same.length) return same[same.length - 1];
  }
  return null;
}

function findLastDateInMatchingLines(lines: string[], pattern: RegExp, now: Date): string | null {
  for (const line of lines) {
    if (!line || !pattern.test(line)) continue;
    const dates = extractIsoDatesFromText(line, now);
    if (dates.length) return dates[dates.length - 1];
  }
  return null;
}

function toMonthDay(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-"); // datetime 안전 처리
  return `${m}/${d}`;
}

/**
 * 전체 행에서 "당첨자 발표" 또는 "당첨자 공지" 키워드로 날짜를 찾습니다.
 * parseOverview 에서 추출하지 못했을 때의 최종 fallback.
 */
function findWinnerAnnouncementInLines(lines: string[], now: Date): string | null {
  for (let i = 0; i < lines.length; i++) {
    const norm = lines[i].replace(/\s+/g, "");
    // 단독 레이블 행 ("당첨자발표", "당첨자공지")
    if (norm === "당첨자발표" || norm === "당첨자공지") {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const v = lines[j]?.trim();
        if (!v) continue;
        const dates = extractIsoDatesFromText(v, now);
        if (dates.length) return dates[0];
      }
    }
    // 인라인 "당첨자 발표 2026-05-01" / "당첨자 공지 2026년 04월 16일"
    if (/당첨자\s*(?:발표|공지)/.test(lines[i])) {
      const dates = extractIsoDatesFromText(lines[i], now);
      if (dates.length) return dates[0];
    }
  }
  return null;
}
