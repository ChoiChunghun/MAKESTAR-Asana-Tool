import type { NormalizedPlanData } from "@/types/parser";

export function parseProductCode(data: NormalizedPlanData): string | null {
  const labelPatterns = [
    /상품\s*코드\s*[:：]?\s*([A-Z0-9_]*P_\d+[A-Z0-9_]*)/i,
    /상품코드\s*[:：]?\s*([A-Z0-9_]*P_\d+[A-Z0-9_]*)/i
  ];

  for (const line of data.lines) {
    for (const pattern of labelPatterns) {
      const match = line.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
  }

  const fullMatch = data.fullText.match(/P_\d+[A-Z0-9_]*/i);
  return fullMatch?.[0] ?? null;
}
