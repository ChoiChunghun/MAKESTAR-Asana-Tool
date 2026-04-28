import type { NormalizedPlanData, ParsedItem } from "@/types/parser";
import { BENEFIT_KEYWORDS, EXCLUDE_PATTERNS_BENEFIT } from "./constants";
import { escapeRegExp, stopAtNotice } from "./utils";

export function parseBenefits(data: NormalizedPlanData): ParsedItem[] {
  const results: ParsedItem[] = [];
  const seen = new Map<string, number>();
  const lines = stopAtNotice(data.benefitLines);

  for (const line of lines) {
    const cell = String(line || "").trim();
    if (!cell) continue;

    const benefitKeyword = findBenefitKeyword(cell);
    if (!benefitKeyword) continue;
    if (cell.includes("포토카드")) continue;

    const item = extractBenefitItem(cell, benefitKeyword);
    if (!item) continue;
    if (shouldExcludeBenefitCell(cell, item.name, item.count)) continue;

    const existingIndex = seen.get(item.name);
    if (existingIndex !== undefined) {
      results[existingIndex].count += item.count;
    } else {
      seen.set(item.name, results.length);
      results.push(item);
    }
  }

  return results;
}

export function findBenefitKeyword(text: string): string | null {
  for (const keyword of BENEFIT_KEYWORDS) {
    if (text.includes(keyword)) return keyword;
  }
  return null;
}

export function shouldExcludeBenefitCell(cell: string, benefitName: string, count: number): boolean {
  const normalized = String(cell).replace(/\s+/g, " ").trim();
  const concretePattern = new RegExp(`${escapeRegExp(benefitName)}\\s*${count}\\s*(?:매|종|개)`);

  if (concretePattern.test(normalized)) return false;

  return EXCLUDE_PATTERNS_BENEFIT.some((pattern) => pattern.test(normalized));
}

export function extractBenefitItem(cell: string, benefitKeyword: string): ParsedItem | null {
  const normalized = String(cell).replace(/\s+/g, " ").trim();
  const escapedKeyword = escapeRegExp(benefitKeyword);
  const match = normalized.match(new RegExp(`(.{0,80}?${escapedKeyword})\\s*(\\d+)\\s*(?:매|종|개)`));

  if (!match) return null;

  const name = match[1]
    .replace(/^\d+\.\s*/, "")
    .replace(/^[-•]\s*/, "")
    .replace(/.*(?:구매\s*시|특전\s*[:：]|증정품\s*[:：]|구성\s*[:：]|\/|,|·)\s*/, "")
    .replace(/\s*\(.*?\)\s*$/g, "")
    .trim();

  if (!name || name.length < 2) return null;

  return {
    name,
    count: Number.parseInt(match[2], 10)
  };
}
