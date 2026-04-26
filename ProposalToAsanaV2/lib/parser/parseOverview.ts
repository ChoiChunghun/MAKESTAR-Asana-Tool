import type { NormalizedPlanData } from "@/types/parser";
import { toLines } from "./utils";
import { normalizeDocumentText } from "@/lib/document/normalizeText";

export function buildNormalizedData(rawText: string, sourceFileName?: string): NormalizedPlanData {
  const fullTextRaw = normalizeDocumentText(rawText);
  const allLines = toLines(fullTextRaw);

  // ① "*활용 규칙" 이하 내용 완전 제외
  const rulesIdx = allLines.findIndex((l) => /^\*\s*활용\s*규칙/.test(l));
  const lines = rulesIdx >= 0 ? allLines.slice(0, rulesIdx) : allLines;
  const fullText = lines.join("\n");

  const overview = extractOverviewTable(lines);

  const specialIdx = lines.findIndex((line) =>
    /II\.\s*이벤트\s*특전|메이크스타\s*특전|이벤트\s*특전/.test(line)
  );
  const benefitLines = specialIdx >= 0 ? lines.slice(specialIdx) : [];

  const eventTitle = overview.eventTitle || extractEventTitleFallback(lines);
  const eventSourceText = overview.eventTitle || eventTitle || fullText.slice(0, 200);

  return {
    fullText,
    lines,
    benefitLines,
    benefitText: benefitLines.join("\n"),
    specialIdx,
    eventTitle,
    artistName: overview.artistName,
    albumName: overview.albumName,
    agency: overview.agency,
    venue: overview.venue,
    eventSourceText,
    sourceFileName,
    winnerAnnouncementIso: overview.winnerAnnouncementIso,
    applicationStartIso: overview.applicationStartIso,
    applicationEndIso: overview.applicationEndIso
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 개요 테이블 추출
// ──────────────────────────────────────────────────────────────────────────

type OverviewFields = {
  artistName: string;
  albumName: string;
  agency: string;
  venue: string;
  eventTitle: string;
  winnerAnnouncementIso: string | null;
  applicationStartIso: string | null;
  applicationEndIso: string | null;
};

function extractOverviewTable(lines: string[]): OverviewFields {
  const result: OverviewFields = {
    artistName: "",
    albumName: "",
    agency: "",
    venue: "",
    eventTitle: "",
    winnerAnnouncementIso: null,
    applicationStartIso: null,
    applicationEndIso: null
  };

  // I. 이벤트 개요 ~ II. 이벤트 특전 사이 범위만 스캔
  const overviewStart = lines.findIndex((l) => /I\.\s*이벤트\s*개요/.test(l));
  const overviewEnd = lines.findIndex((l) => /II\.\s*이벤트\s*특전/.test(l));
  const start = overviewStart >= 0 ? overviewStart : 0;
  const end = overviewEnd > start ? overviewEnd : Math.min(start + 80, lines.length);
  const scanLines = lines.slice(start, end);

  // 레이블 키 목록 (다음 레이블 만나면 값 수집 중단)
  const LABEL_KEYS = [
    "아티스트", "앨범", "소속사", "진행장소", "이벤트명",
    "진행일시", "당첨자수", "이벤트소요시간", "판매처",
    "응모기간", "당첨자발표"
  ];

  const found = new Set<string>();

  for (let i = 0; i < scanLines.length; i++) {
    const line = scanLines[i];
    const norm = line.replace(/\s+/g, "");

    // ── 아티스트 (② 영문 우선) ───────────────────────────────────────────
    if (!found.has("artistName")) {
      if (norm === "아티스트") {
        const raw = findNextNonEmptyValue(scanLines, i + 1, LABEL_KEYS);
        if (raw) { result.artistName = extractEnglishName(raw); found.add("artistName"); }
      } else if (norm.startsWith("아티스트") && norm.length > 3) {
        const raw = extractValueAfterLabel(line, "아티스트");
        if (raw) { result.artistName = extractEnglishName(raw); found.add("artistName"); }
      }
    }

    // ── 앨범 ────────────────────────────────────────────────────────────
    if (!found.has("albumName")) {
      if (norm === "앨범") {
        const v = findNextNonEmptyValue(scanLines, i + 1, LABEL_KEYS);
        if (v) { result.albumName = v; found.add("albumName"); }
      } else if (norm.startsWith("앨범") && norm.length > 2) {
        const v = extractValueAfterLabel(line, "앨범");
        if (v) { result.albumName = v; found.add("albumName"); }
      }
    }

    // ── 소속사 ──────────────────────────────────────────────────────────
    if (!found.has("agency")) {
      if (norm === "소속사") {
        const v = findNextNonEmptyValue(scanLines, i + 1, LABEL_KEYS);
        if (v) { result.agency = v; found.add("agency"); }
      } else if (norm.startsWith("소속사") && norm.length > 3) {
        const v = extractValueAfterLabel(line, "소속사");
        if (v) { result.agency = v; found.add("agency"); }
      }
    }

    // ── 진행장소 ────────────────────────────────────────────────────────
    if (!found.has("venue")) {
      if (norm === "진행장소") {
        const v = findNextNonEmptyValue(scanLines, i + 1, LABEL_KEYS);
        if (v) { result.venue = v; found.add("venue"); }
      } else if (norm.startsWith("진행장소") && norm.length > 4) {
        const v = extractValueAfterLabel(line, "진행장소");
        if (v) { result.venue = v; found.add("venue"); }
      }
    }

    // ── 이벤트명 (③ 영문 또는 국문 그대로) ──────────────────────────────
    if (!found.has("eventTitle")) {
      if (norm === "이벤트명") {
        // 여러 부(部)가 있을 수 있으므로 다음 줄들을 수집해 합침
        const raw = collectEventTitleLines(scanLines, i + 1, LABEL_KEYS);
        if (raw && !raw.startsWith("{")) {
          result.eventTitle = raw.replace(/^\d+부\s*/i, "").trim();
          found.add("eventTitle");
        }
      } else if (/이벤트명/.test(norm)) {
        const raw = extractValueAfterLabel(line, "이벤트명");
        if (raw && !raw.startsWith("{")) {
          result.eventTitle = raw.replace(/^N부\s*/i, "").trim();
          found.add("eventTitle");
        }
      }
    }

    // ── 응모기간 (④ 시작 ~ 종료 파싱) ───────────────────────────────────
    if (!found.has("applicationPeriod")) {
      if (norm === "응모기간") {
        const raw = findPeriodValue(scanLines, i + 1, LABEL_KEYS);
        if (raw) {
          const { startIso, endIso } = parseApplicationPeriod(raw);
          result.applicationStartIso = startIso;
          result.applicationEndIso = endIso;
          found.add("applicationPeriod");
        }
      } else if (/응모기간/.test(norm)) {
        const raw = extractValueAfterLabel(line, "응모기간");
        if (raw) {
          const { startIso, endIso } = parseApplicationPeriod(raw);
          result.applicationStartIso = startIso;
          result.applicationEndIso = endIso;
          found.add("applicationPeriod");
        }
      }
    }

    // ── 당첨자 발표 (⑤ YYYY-MM-DD 추출) ─────────────────────────────────
    if (!found.has("winnerAnnouncement")) {
      if (norm === "당첨자발표") {
        const raw = findNextNonEmptyValue(scanLines, i + 1, LABEL_KEYS);
        if (raw) {
          const iso = parseFirstIsoDate(raw);
          if (iso) { result.winnerAnnouncementIso = iso; found.add("winnerAnnouncement"); }
        }
      } else if (/당첨자\s*발표/.test(line)) {
        // 인라인 또는 다음 줄 탐색
        const inlineRaw = extractValueAfterLabel(line, "당첨자");
        const raw = inlineRaw || findNextNonEmptyValue(scanLines, i + 1, LABEL_KEYS);
        if (raw) {
          const iso = parseFirstIsoDate(raw);
          if (iso) { result.winnerAnnouncementIso = iso; found.add("winnerAnnouncement"); }
        }
      }
    }
  }

  return result;
}

// ──────────────────────────────────────────────────────────────────────────
// 헬퍼: 아티스트 영문명 추출
// ──────────────────────────────────────────────────────────────────────────

function extractEnglishName(value: string): string {
  const v = value.trim();
  // 영문 알파벳으로 시작하는 토큰들을 우선 수집
  const matches = v.match(/[A-Za-z][A-Za-z0-9\s&\-_.!?]+/g);
  if (matches) {
    const longest = matches.reduce((a, b) => (a.length >= b.length ? a : b), "");
    const trimmed = longest.trim();
    if (trimmed.length >= 2) return trimmed;
  }
  // 괄호 안 영문 (예: 방탄소년단 (BTS))
  const parenMatch = v.match(/\(([A-Za-z][A-Za-z0-9\s&\-_.]+)\)/);
  if (parenMatch) return parenMatch[1].trim();
  return v;
}

// ──────────────────────────────────────────────────────────────────────────
// 헬퍼: 이벤트명 여러 줄 수집 (N부 → 1부, 2부 실제값 모두 합침)
// ──────────────────────────────────────────────────────────────────────────

function collectEventTitleLines(lines: string[], startIdx: number, labelKeys: string[]): string {
  const parts: string[] = [];
  for (let j = startIdx; j < Math.min(startIdx + 6, lines.length); j++) {
    const v = lines[j]?.trim();
    if (!v) continue;
    if (labelKeys.some((k) => v.replace(/\s+/g, "") === k)) break;
    if (/^\{.*\}$/.test(v)) continue; // 플레이스홀더 제외
    // "N부" 리터럴 플레이스홀더 제외
    if (/^N부\s*\{/.test(v)) continue;
    parts.push(v.replace(/^\d+부\s*/i, "").trim());
  }
  return parts.join(" / ");
}

// ──────────────────────────────────────────────────────────────────────────
// 헬퍼: 응모기간 여러 줄 수집 (start ~ end가 줄 걸쳐 있을 수 있음)
// ──────────────────────────────────────────────────────────────────────────

function findPeriodValue(lines: string[], startIdx: number, labelKeys: string[]): string {
  const parts: string[] = [];
  for (let j = startIdx; j < Math.min(startIdx + 8, lines.length); j++) {
    const v = lines[j]?.trim();
    if (!v) continue;
    if (labelKeys.some((k) => v.replace(/\s+/g, "") === k)) break;
    parts.push(v);
    const joined = parts.join(" ");
    // start와 end 날짜를 모두 수집했으면 중단
    if (/[~∼～]/.test(joined)) {
      const afterTilde = joined.split(/[~∼～]/)[1] || "";
      if (/\d{4}-\d{1,2}-\d{1,2}/.test(afterTilde)) break;
    }
  }
  return parts.join(" ");
}

// ──────────────────────────────────────────────────────────────────────────
// 헬퍼: 응모기간 "YYYY-MM-DD ... ~ YYYY-MM-DD ..." 파싱
// ──────────────────────────────────────────────────────────────────────────

function parseApplicationPeriod(text: string): { startIso: string | null; endIso: string | null } {
  // 요일 태그 (월)~(일) 및 (KST) 제거
  const cleaned = text
    .replace(/\([월화수목금토일]\)/g, "")
    .replace(/\(KST\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const parts = cleaned.split(/\s*[~∼～]\s*/);

  return {
    startIso: parts.length >= 1 ? extractIsoDateFromString(parts[0]) : null,
    endIso: parts.length >= 2 ? extractIsoDateFromString(parts[1]) : null
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 헬퍼: 문자열에서 첫 번째 YYYY-MM-DD 추출
// ──────────────────────────────────────────────────────────────────────────

function extractIsoDateFromString(s: string): string | null {
  // 요일/KST 제거 후 날짜 추출
  const cleaned = s
    .replace(/\([월화수목금토일]\)/g, "")
    .replace(/\(KST\)/gi, "")
    .trim();
  const m = cleaned.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (!isValidDate(y, mo, d)) return null;
  return `${m[1]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseFirstIsoDate(text: string): string | null {
  return extractIsoDateFromString(text);
}

// ──────────────────────────────────────────────────────────────────────────
// 기존 유틸 (변경 없음)
// ──────────────────────────────────────────────────────────────────────────

function extractValueAfterLabel(line: string, label: string): string {
  const idx = line.indexOf(label);
  if (idx < 0) return "";
  return line.slice(idx + label.length).replace(/^[\s:：]+/, "").trim();
}

function findNextNonEmptyValue(lines: string[], startIdx: number, labelKeys: string[]): string {
  for (let j = startIdx; j < Math.min(startIdx + 5, lines.length); j++) {
    const v = lines[j]?.trim();
    if (!v) continue;
    if (labelKeys.some((k) => v.replace(/\s+/g, "") === k)) break;
    if (/^\{.*\}$/.test(v)) return "";
    return v;
  }
  return "";
}

function extractEventTitleFallback(lines: string[]): string {
  const labelPatterns = [
    /이벤트\s*명\s*[:：]?\s*(.+)$/i,
    /행사\s*명\s*[:：]?\s*(.+)$/i,
    /기획전\s*명\s*[:：]?\s*(.+)$/i
  ];
  for (const line of lines) {
    for (const pattern of labelPatterns) {
      const match = line.match(pattern);
      if (match?.[1]?.trim()) return match[1].trim();
    }
  }
  return lines.find((l) => l.length >= 3) || "";
}

// ──────────────────────────────────────────────────────────────────────────
// 날짜 유틸 (외부에서도 사용)
// ──────────────────────────────────────────────────────────────────────────

export function extractIsoDatesFromText(text: string, now: Date): string[] {
  const matches: string[] = [];
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return matches;

  const fullYearRegex = /(\d{4})[.\-\/년]\s*(\d{1,2})[.\-\/월]\s*(\d{1,2})(?:일)?/g;
  const shortYearRegex = /(\d{2})[.\-\/]\s*(\d{1,2})[.\-\/]\s*(\d{1,2})/g;

  Array.from(t.matchAll(fullYearRegex)).forEach((m) => {
    addDate(matches, Number(m[1]), Number(m[2]), Number(m[3]));
  });
  Array.from(t.matchAll(shortYearRegex)).forEach((m) => {
    addDate(matches, 2000 + Number(m[1]), Number(m[2]), Number(m[3]));
  });

  const { year } = getKstYear(now);
  const monthDayRegex = /(^|[^\d.\-\/])(\d{1,2})[.\-\/월]\s*(\d{1,2})(?:일)?/g;
  Array.from(t.matchAll(monthDayRegex)).forEach((m) => {
    addDate(matches, year, Number(m[2]), Number(m[3]));
  });

  return dedupeIsoDates(matches);
}

function getKstYear(date: Date): { year: number } {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return { year: kst.getUTCFullYear() };
}

function addDate(matches: string[], year: number, month: number, day: number): void {
  if (!isValidDate(year, month, day)) return;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  matches.push(iso);
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function dedupeIsoDates(dates: string[]): string[] {
  const seen = new Set<string>();
  return dates.filter((d) => {
    if (seen.has(d)) return false;
    seen.add(d);
    return true;
  });
}
