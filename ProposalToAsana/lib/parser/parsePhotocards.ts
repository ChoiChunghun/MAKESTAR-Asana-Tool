import type { NormalizedPlanData, ParsedItem } from "@/types/parser";
import { EXCLUDE_KEYWORDS_PC } from "./constants";
import { stopAtNotice } from "./utils";

export function parsePhotocards(data: NormalizedPlanData): ParsedItem[] {
  const results: ParsedItem[] = [];
  const seen = new Set<string>();
  const lines = stopAtNotice(data.benefitLines);

  for (const line of lines) {
    const cell = String(line || "").trim();
    if (!cell || !cell.includes("포토카드")) continue;
    if (EXCLUDE_KEYWORDS_PC.some((keyword) => cell.includes(keyword))) continue;

    const countMatch = cell.match(/(\d+)\s*(?:매|종)/);
    if (!countMatch) continue;

    const count = Number.parseInt(countMatch[1], 10);
    const name = cell
      .replace(/^\d+\.\s*/, "")
      .replace(/^[-•]\s*/, "")
      .replace(/\s*\d+\s*(?:매|종).*$/, "")
      .replace(/\s*\(.*?\)/g, "")
      .replace(/\s*-.*$/, "")
      .trim();

    if (!name || name.length < 3 || seen.has(name)) continue;

    seen.add(name);
    results.push({ name, count });
  }

  return results;
}
