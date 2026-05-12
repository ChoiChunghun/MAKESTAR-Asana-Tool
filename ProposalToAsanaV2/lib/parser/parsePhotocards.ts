import type { NormalizedPlanData, ParseConfig, ParsedItem } from "@/types/parser";
import { EXCLUDE_KEYWORDS_PC, EXCLUDE_PATTERNS_PC, PC_NAME_PREFIX_STRIP } from "./constants";
import { stopAtNotice } from "./utils";

export function parsePhotocards(data: NormalizedPlanData, config?: ParseConfig): ParsedItem[] {
  const excludeKeywords = config?.pcExcludeKeywords ?? EXCLUDE_KEYWORDS_PC;

  const results: ParsedItem[] = [];
  const seen = new Map<string, number>();
  const lines = stopAtNotice(data.benefitLines);

  for (let i = 0; i < lines.length; i++) {
    const cell = String(lines[i] || "").trim();
    if (!cell.includes("포토카드")) continue;
    if (excludeKeywords.some((kw) => cell.includes(kw))) continue;
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

    // 버전 구분자 보존 — "(천사 ver.)" / "(악마 ver.)" 등이 원본 행에 있으면
    // 이름에 포함시켜 동일 이름으로 합산되지 않도록 분리한다
    const verMatch = cell.match(/\(\s*([^)]*ver\.?[^)]*)\s*\)/i);
    if (verMatch) {
      name = `${name} (${verMatch[1].trim()})`;
    }

    // "사인" 단독 이름 = 사인(서명) 포토카드 → 포카 버전으로 분류 안 함
    if (!name || name.length < 2) name = "포토카드";
    if (name === "사인") continue;

    const existing = seen.get(name);
    if (existing !== undefined) {
      // 같은 버전이 여러 For. 구간에 중복 등장할 경우 합산하지 않고 MAX를 유지
      results[existing].count = Math.max(results[existing].count, count);
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

  // 4순위: 승리/패배 컨셉 쌍 감지 → 명시 총 수량 없으면 멤버수 × 2종
  if (/승리.{0,6}패배|패배.{0,6}승리/.test(combined)) {
    const memberCount = inferMemberCountFromContext(lines, lineIdx);
    return memberCount > 0 ? memberCount * 2 : 2; // 최소 2종 (승리 + 패배)
  }

  // fallback: 첫 번째 매/종 숫자
  const fallback = combined.match(/(\d+)\s*(?:매|종)/);
  if (fallback) return parseInt(fallback[1], 10);

  return 0;
}

/**
 * 주변 라인의 "(N종)" 패턴에서 멤버 수를 추정합니다.
 * 같은 파트 특전 블록에서 "포토카드 1매 (7종)" 처럼 멤버 단위로 명시된 수량을 찾아 반환합니다.
 */
function inferMemberCountFromContext(lines: string[], lineIdx: number): number {
  const start = Math.max(0, lineIdx - 30);
  const end = Math.min(lines.length, lineIdx + 10);
  const counts: number[] = [];

  for (let i = start; i < end; i++) {
    if (i === lineIdx) continue;
    const m = lines[i].match(/\((\d+)\s*종\)/);
    if (m) {
      const n = parseInt(m[1]);
      if (n >= 2 && n <= 30) counts.push(n); // 합리적 멤버 수 범위
    }
  }

  if (counts.length === 0) return 0;
  // 가장 자주 등장하는 값 반환
  const freq: Record<number, number> = {};
  for (const c of counts) freq[c] = (freq[c] || 0) + 1;
  return Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
}
