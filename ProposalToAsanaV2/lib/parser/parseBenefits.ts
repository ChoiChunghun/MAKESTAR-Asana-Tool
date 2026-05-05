import type { NormalizedPlanData, ParsedItem } from "@/types/parser";
import { BENEFIT_KEYWORDS, EXCLUDE_PATTERNS_BENEFIT, HANDWRITING_KEYWORDS } from "./constants";
import { escapeRegExp, hasKeyword, stopAtNotice } from "./utils";

export function parseBenefits(data: NormalizedPlanData): ParsedItem[] {
  const results: ParsedItem[] = [];
  const seen = new Map<string, number>();
  const lines = stopAtNotice(data.benefitLines);

  for (const line of lines) {
    const cell = String(line || "").trim();
    if (!cell) continue;

    const keyword = findBenefitKeyword(cell);
    if (!keyword) continue;
    if (cell.includes("포토카드")) continue;

    const item = extractBenefitItem(cell, keyword);
    if (!item) continue;
    if (shouldExclude(cell, item.name, item.count)) continue;

    // 원본 줄 전체에서 손그림 키워드 체크 (이름에 없어도 감지)
    const hasHandwriting = hasKeyword(cell, HANDWRITING_KEYWORDS);
    if (hasHandwriting) item.hasHandwriting = true;

    const idx = seen.get(item.name);
    if (idx !== undefined) {
      results[idx].count += item.count;
      if (hasHandwriting) results[idx].hasHandwriting = true;
    } else {
      seen.set(item.name, results.length);
      results.push(item);
    }
  }

  return results;
}

function findBenefitKeyword(text: string): string | null {
  for (const kw of BENEFIT_KEYWORDS) {
    if (text.includes(kw)) return kw;
  }
  return null;
}

function shouldExclude(cell: string, name: string, count: number): boolean {
  const normalized = cell.replace(/\s+/g, " ").trim();
  const concretePattern = new RegExp(`${escapeRegExp(name)}\\s*${count}\\s*(?:매|종|개)`);
  if (concretePattern.test(normalized)) return false;
  return EXCLUDE_PATTERNS_BENEFIT.some((p) => p.test(normalized));
}

// 한국어 문장 연결어 기준으로 분리해 keyword+count가 있는 마지막 세그먼트만 사용
const SENTENCE_SPLITTER = /(?:와\s|과\s|이고\s|이며\s|담긴\s|들어간\s|포함된\s|으로\s(?=\S)|로\s(?=\S)|를\s포함|을\s포함|에게\s)/;

function extractBenefitItem(cell: string, keyword: string): ParsedItem | null {
  const normalized = cell.replace(/\s+/g, " ").trim();
  const ek = escapeRegExp(keyword);
  // 단위: 매/종/개/통(편지지)/세트(일회용 밴드 등) 포함
  const UNIT = "(?:매|종|개|통|세트|SET)";
  const countPattern = new RegExp(`${ek}[^\\d]{0,10}(\\d+)\\s*${UNIT}|(.{0,30}${ek})\\s*(\\d+)\\s*${UNIT}`);

  // 문장을 연결어로 분리해 keyword+count가 있는 세그먼트를 역순으로 탐색
  const segments = normalized.split(SENTENCE_SPLITTER).reverse();
  for (const seg of segments) {
    if (!seg.includes(keyword)) continue;
    const match = seg.match(new RegExp(`(.{0,35}?${ek})\\s*(\\d+)\\s*${UNIT}`));
    if (!match) continue;

    const name = cleanName(match[1]);
    if (!name || name.length < 2) continue;
    return { name, count: parseInt(match[2], 10) };
  }

  // fallback: 전체 문자열에서 시도 (세그먼트 분리 실패 시)
  const fallback = normalized.match(new RegExp(`(.{0,80}?${ek})\\s*(\\d+)\\s*${UNIT}`));
  if (!fallback) return null;

  const name = cleanName(fallback[1]);
  if (!name || name.length < 2) return null;
  return { name, count: parseInt(fallback[2], 10) };
}

function cleanName(raw: string): string {
  return raw
    .replace(/^\d+\.\s*/, "")
    .replace(/^[-•★]\s*/, "")
    .replace(/.*(?:구매\s*시|특전\s*[:：]|증정품\s*[:：]|구성\s*[:：]|\/|,|·)\s*/, "")
    // "제작된 스티커", "만들어진 파우치" 등 한국어 분사형(-된/-진) 수식어 제거
    .replace(/^\S+(?:된|진)\s+/, "")
    .replace(/\s*\(.*?\)\s*$/g, "")
    .trim();
}
