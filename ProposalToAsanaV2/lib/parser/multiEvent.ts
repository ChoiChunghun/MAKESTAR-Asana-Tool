/**
 * multiEvent.ts
 *
 * 한 기획서에 복수의 이벤트(1부/2부 …)가 담긴 경우를 감지·분리합니다.
 *
 * Pattern A (예: NEXZ)
 *   "1부", "2부", "3부" 처럼 단독 행으로 구분자가 있고
 *   각 구간이 독립적인 이벤트 블록을 형성하는 문서.
 *
 * Pattern B (예: TXT)
 *   단일 "I. 이벤트 개요" 테이블 안에서 필드 값이
 *   "1부: ...\n2부: ..." 형태로 분리되어 있고,
 *   특전 섹션에 "<1부 ...>" / "<2부 ...>" 마커가 있는 문서.
 */

import type { NormalizedPlanData } from "@/types/parser";
import { buildNormalizedData } from "./parseOverview";
import { toLines } from "./utils";
import { normalizeDocumentText } from "@/lib/document/normalizeText";

export type MultiEventPattern = "A" | "B";

// ─────────────────────────────────────────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 다중 이벤트 패턴을 감지합니다.
 * 단일 이벤트면 null, Pattern A / B 이면 해당 값을 반환합니다.
 */
export function detectMultiEventPattern(lines: string[]): MultiEventPattern | null {
  // Pattern A: 단독 "N부" 행이 2개 이상
  const standaloneCount = lines.filter((l) => /^\s*[1-9]부\s*$/.test(l.trim())).length;
  if (standaloneCount >= 2) return "A";

  // Pattern B: 특전 섹션에 "<N부 ...>" 마커
  const hasBenefitMarkers =
    lines.some((l) => /<[1-9]부[\s>]/.test(l)) &&
    // 오탐 방지: 단순 텍스트 안의 <부> 와 구별 — 마커는 "<숫자부 " 또는 "<숫자부>" 형태
    lines.filter((l) => /<[1-9]부[\s>]/.test(l)).length >= 2;
  if (hasBenefitMarkers) return "B";

  // Pattern B: 필드 값 내 "N부:" 인라인 분리가 2개 이상
  const inlinePartLines = lines.filter((l) => /^\s*[1-9]부\s*[:：]/.test(l.trim()));
  if (inlinePartLines.length >= 2) return "B";

  return null;
}

/**
 * 원문 텍스트에서 다중 이벤트 NormalizedPlanData 배열을 생성합니다.
 * 단일 이벤트 문서면 null 을 반환합니다.
 */
export function buildMultiEventData(
  rawText: string,
  sourceFileName?: string
): NormalizedPlanData[] | null {
  const normalizedText = normalizeDocumentText(rawText);
  const allLines = toLines(normalizedText);

  // "*활용 규칙" 이하 제외
  const rulesIdx = allLines.findIndex((l) => /^\*\s*활용\s*규칙/.test(l));
  const lines = rulesIdx >= 0 ? allLines.slice(0, rulesIdx) : allLines;

  const pattern = detectMultiEventPattern(lines);
  if (!pattern) return null;

  if (pattern === "A") return splitPatternA(lines, sourceFileName);
  return splitPatternB(lines, sourceFileName);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pattern A – 단독 "N부" 구분자로 분리
// ─────────────────────────────────────────────────────────────────────────────

function splitPatternA(lines: string[], sourceFileName?: string): NormalizedPlanData[] {
  const partBoundaries: { idx: number; label: string }[] = [];

  lines.forEach((l, i) => {
    if (/^\s*[1-9]부\s*$/.test(l.trim())) {
      partBoundaries.push({ idx: i, label: l.trim() });
    }
  });

  if (partBoundaries.length < 2) return [];

  return partBoundaries.map(({ idx, label }, p) => {
    const end =
      p + 1 < partBoundaries.length ? partBoundaries[p + 1].idx : lines.length;
    const partText = lines.slice(idx, end).join("\n");
    const data = buildNormalizedData(partText, sourceFileName);
    return { ...data, partLabel: label };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Pattern B – 단일 테이블 + 인라인 "N부:" 분리 + 특전 마커
// ─────────────────────────────────────────────────────────────────────────────

function splitPatternB(lines: string[], sourceFileName?: string): NormalizedPlanData[] {
  // 공통 기반 데이터 (아티스트, 앨범, 소속사, 진행장소 등)
  const baseData = buildNormalizedData(lines.join("\n"), sourceFileName);

  // 부(部) 수 파악
  const partCount = detectPartCount(lines);
  if (partCount < 2) return [];

  // 이벤트명 부별 추출
  const perPartTitles = extractPerPartEventTitles(lines);

  // 응모기간 부별 추출
  const perPartDates = extractPerPartDates(lines);

  // 당첨자 발표일 부별 추출
  const perPartWinner = extractPerPartWinner(lines);

  // 특전 섹션 부별 분리
  const perPartBenefits = splitBenefitsByPart(lines, baseData.specialIdx);

  const results: NormalizedPlanData[] = [];

  for (let p = 1; p <= partCount; p++) {
    const partLabel = `${p}부`;
    const eventTitle = perPartTitles[p] ?? baseData.eventTitle;

    const partBenefitLines = perPartBenefits.get(p) ?? [];
    const hasBenefitLines = partBenefitLines.length > 0;

    const dates = perPartDates[p];
    const winnerIso = perPartWinner[p] ?? baseData.winnerAnnouncementIso ?? null;

    results.push({
      ...baseData,
      eventTitle,
      partLabel,
      benefitLines: hasBenefitLines ? partBenefitLines : baseData.benefitLines,
      benefitText: hasBenefitLines
        ? partBenefitLines.join("\n")
        : baseData.benefitText,
      specialIdx: hasBenefitLines ? 0 : baseData.specialIdx,
      applicationStartIso: dates?.startIso ?? baseData.applicationStartIso,
      applicationEndIso: dates?.endIso ?? baseData.applicationEndIso,
      winnerAnnouncementIso: winnerIso,
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼 – Pattern B 파싱
// ─────────────────────────────────────────────────────────────────────────────

/** 부(部) 수를 파악합니다. */
function detectPartCount(lines: string[]): number {
  // 특전 마커 우선
  const markerParts = new Set<number>();
  lines.forEach((l) => {
    const m = l.match(/<(\d+)부/);
    if (m) markerParts.add(Number(m[1]));
  });
  if (markerParts.size >= 2) return markerParts.size;

  // 인라인 "N부:" 패턴
  const inlineParts = new Set<number>();
  lines.forEach((l) => {
    const m = l.trim().match(/^(\d+)부\s*[:：]/);
    if (m) inlineParts.add(Number(m[1]));
  });
  if (inlineParts.size >= 2) return inlineParts.size;

  return 0;
}

const OVERVIEW_LABEL_KEYS_RE =
  /^(아티스트|앨범|소속사|진행장소|진행일시|당첨자수|이벤트소요시간|판매처|응모기간|판매기간|당첨자발표|당첨자공지)$/;

/**
 * "이벤트명" 레이블 이후 줄에서 "N부: 값" 패턴으로 부별 이벤트명을 추출합니다.
 */
function extractPerPartEventTitles(lines: string[]): Record<number, string> {
  const result: Record<number, string> = {};

  for (let i = 0; i < lines.length; i++) {
    const norm = lines[i].replace(/\s+/g, "");
    if (norm !== "이벤트명") continue;

    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      const trimmed = lines[j]?.trim();
      if (!trimmed) continue;
      if (OVERVIEW_LABEL_KEYS_RE.test(trimmed.replace(/\s+/g, ""))) break;

      const partMatch = trimmed.match(/^(\d+)부\s*[:：]\s*(.*)/);
      if (partMatch) {
        result[Number(partMatch[1])] = partMatch[2].trim();
      }
    }
    break;
  }

  return result;
}

/**
 * 응모기간/판매기간 레이블 이후 줄에서 "N부: 날짜 ~ 날짜" 패턴을 추출합니다.
 */
function extractPerPartDates(
  lines: string[]
): Record<number, { startIso: string | null; endIso: string | null }> {
  const result: Record<number, { startIso: string | null; endIso: string | null }> = {};

  for (let i = 0; i < lines.length; i++) {
    const norm = lines[i].replace(/\s+/g, "");
    if (norm !== "응모기간" && norm !== "판매기간") continue;

    for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
      const trimmed = lines[j]?.trim();
      if (!trimmed) continue;
      if (OVERVIEW_LABEL_KEYS_RE.test(trimmed.replace(/\s+/g, ""))) break;

      const partMatch = trimmed.match(/^(\d+)부\s*[:：]\s*(.*)/);
      if (partMatch) {
        const partNum = Number(partMatch[1]);
        // 해당 부의 날짜 텍스트가 다음 줄에 이어질 수 있음 → 같은 부의 뒤 줄 합산
        let dateText = partMatch[2].trim();
        for (let k = j + 1; k < Math.min(j + 4, lines.length); k++) {
          const next = lines[k]?.trim();
          if (!next) break;
          if (/^[1-9]부\s*[:：]/.test(next) || OVERVIEW_LABEL_KEYS_RE.test(next.replace(/\s+/g, ""))) break;
          dateText += " " + next;
        }
        result[partNum] = parseApplicationPeriodSimple(dateText);
      }
    }
    break;
  }

  return result;
}

/**
 * 당첨자 발표/공지 레이블 이후 줄에서 "N부: 날짜" 패턴을 추출합니다.
 */
function extractPerPartWinner(lines: string[]): Record<number, string | null> {
  const result: Record<number, string | null> = {};

  for (let i = 0; i < lines.length; i++) {
    const norm = lines[i].replace(/\s+/g, "");
    if (norm !== "당첨자발표" && norm !== "당첨자공지") continue;

    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      const trimmed = lines[j]?.trim();
      if (!trimmed) continue;
      if (OVERVIEW_LABEL_KEYS_RE.test(trimmed.replace(/\s+/g, ""))) break;

      const partMatch = trimmed.match(/^(\d+)부\s*[:：]\s*(.*)/);
      if (partMatch) {
        const partNum = Number(partMatch[1]);
        const iso = extractIsoFromStr(partMatch[2].trim());
        result[partNum] = iso;
      } else {
        // 단일 날짜 → 모든 부에 공통 적용 (이미 baseData.winnerAnnouncementIso 에 들어가므로 skip)
        break;
      }
    }
    break;
  }

  return result;
}

/**
 * 특전 섹션(specialIdx 이후)을 "<N부 ...>" 마커 기준으로 부별로 분리합니다.
 */
function splitBenefitsByPart(
  lines: string[],
  specialIdx: number
): Map<number, string[]> {
  const parts = new Map<number, string[]>();
  let currentPart = 0;

  const benefitLines = specialIdx >= 0 ? lines.slice(specialIdx) : [];

  for (const line of benefitLines) {
    const markerMatch = line.match(/<(\d+)부/);
    if (markerMatch) {
      currentPart = Number(markerMatch[1]);
      if (!parts.has(currentPart)) parts.set(currentPart, []);
    }
    if (currentPart > 0) {
      const arr = parts.get(currentPart)!;
      arr.push(line);
    }
  }

  return parts;
}

// ─────────────────────────────────────────────────────────────────────────────
// 날짜 파싱 유틸 (parseOverview.ts 의 함수와 동일 로직, 의존성 없이 독립)
// ─────────────────────────────────────────────────────────────────────────────

function parseApplicationPeriodSimple(
  text: string
): { startIso: string | null; endIso: string | null } {
  const cleaned = text
    .replace(/\([월화수목금토일]\)/g, "")
    .replace(/\(KST\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const parts = cleaned.split(/\s*[~∼～]\s*/);
  return {
    startIso: parts.length >= 1 ? extractIsoFromStr(parts[0]) : null,
    endIso: parts.length >= 2 ? extractIsoFromStr(parts[1]) : null,
  };
}

function extractIsoFromStr(s: string): string | null {
  const m = s
    .replace(/\([월화수목금토일]\)/g, "")
    .replace(/\(KST\)/gi, "")
    .trim()
    .match(/(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})(?:[^\d](\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dateStr = `${m[1]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (m[4] !== undefined && m[5] !== undefined) {
    const h = Number(m[4]);
    if (h >= 0 && h <= 23) return `${dateStr}T${String(h).padStart(2, "0")}:${m[5]}`;
  }
  return dateStr;
}
