import type { NormalizedPlanData, ParsedItem } from "@/types/parser";
import { EXCLUDE_KEYWORDS_PC, EXCLUDE_PATTERNS_PC, PC_NAME_PREFIX_STRIP } from "./constants";
import { stopAtNotice } from "./utils";

export function parsePhotocards(data: NormalizedPlanData): ParsedItem[] {
  const results: ParsedItem[] = [];
  const seen = new Map<string, number>();
  const lines = stopAtNotice(data.benefitLines);

  for (let i = 0; i < lines.length; i++) {
    const cell = String(lines[i] || "").trim();
    if (!cell.includes("포토카드")) continue;
    if (EXCLUDE_KEYWORDS_PC.some((kw) => cell.includes(kw))) continue;
    if (EXCLUDE_PATTERNS_PC.some((p) => p.test(cell))) continue;

    // count: 총 수량(종) 우선, 없으면 n종 중/랜덤, 없으면 괄호 종, 마지막 fallback
    const count = extractPcCount(cell, lines, i);
    const nextLineUsed = false; // name extraction below uses this flag; always false now

    if (!count) continue;

    // 컨셉명 추출: "포토카드" 앞 텍스트 → 뒷 텍스트 → 다음 행 텍스트 순으로 시도
    const pcIdx = cell.indexOf("포토카드");
    const beforePc = cell.slice(0, pcIdx).trim();
    const afterPc = cell.slice(pcIdx + 4).replace(/\s*\d+\s*(?:매|종).*$/, "").trim();

    let name = "";
    if (beforePc.length >= 2) {
      name = beforePc;
    } else if (afterPc.length >= 2) {
      name = afterPc;
    } else if (nextLineUsed) {
      const nextCell = String(lines[i + 1] || "").trim();
      name = nextCell.replace(/\s*\d+\s*(?:매|종).*$/, "").trim();
    }

    // 정리
    name = name
      .replace(/^\d+\.\s*/, "")
      .replace(/^[-•★]\s*/, "")
      .replace(/\s*\(.*?\)/g, "")
      .replace(/\s*[-–]\s*.*$/, "")
      // 구매 조건 문구가 남아 있으면 조건 뒤 내용 제거 (안전망)
      .replace(/^.*(구매\s*시|추가\s*증정)\s*/i, "")
      .trim();

    // 앞 수식어 제거 (응모한 멤버의, 당첨자 한정 등)
    for (const pattern of PC_NAME_PREFIX_STRIP) {
      name = name.replace(pattern, "").trim();
    }

    if (!name || name.length < 2) name = "포토카드";

    const existing = seen.get(name);
    if (existing !== undefined) {
      results[existing].count += count;
    } else {
      seen.set(name, results.length);
      results.push({ name, count });
    }
  }

  return results;
}

/**
 * 포토카드 총 수량(종) 추출.
 * 우선순위:
 *  1. "총 n종/장/매" — 명시적 합계
 *  2. "n종 중" / "n종 랜덤" — 버전 종류 수
 *  3. 현재 행 괄호 안 "n종" — "(A ver. 2종)"
 *  4. fallback: 첫 번째 숫자+매/종
 */
function extractPcCount(cell: string, lines: string[], lineIdx: number): number {
  // 현재 행 + 이후 최대 3개 서브 줄 수집 (새 번호 항목·구조 마커에서 중단)
  const candidates = [cell];
  for (let j = lineIdx + 1; j < Math.min(lineIdx + 4, lines.length); j++) {
    const next = String(lines[j] || "").trim();
    if (/^\d+\.\s+\S/.test(next) || /^[★◆<]/.test(next) || next === "") break;
    candidates.push(next);
  }
  const combined = candidates.join(" ");

  // 1순위: 총 n종/장/매
  const totalMatch = combined.match(/총\s*(\d+)\s*(?:종|장|매)/);
  if (totalMatch) return parseInt(totalMatch[1], 10);

  // 2순위: n종 중 / n종 랜덤
  const varietyMatch = combined.match(/(\d+)\s*종\s*(?:중|랜덤)/);
  if (varietyMatch) return parseInt(varietyMatch[1], 10);

  // 3순위: 같은 행 괄호 안 "n종"
  const parenMatch = cell.match(/\(.*?(\d+)\s*종[^)]*\)/);
  if (parenMatch) return parseInt(parenMatch[1], 10);

  // fallback: 첫 번째 매/종 숫자
  const fallback = combined.match(/(\d+)\s*(?:매|종)/);
  if (fallback) return parseInt(fallback[1], 10);

  return 0;
}
