import type { NormalizedPlanData } from "@/types/parser";
import { toLines } from "@/lib/parser/utils";
import { normalizePdfText } from "./normalizePdfText";

export function buildPdfData(rawText: string, sourceFileName?: string): NormalizedPlanData {
  const fullText = normalizePdfText(rawText);
  const lines = toLines(fullText);
  const specialIdx = lines.findIndex((line) => line.includes("메이크스타 특전"));
  const benefitLines = specialIdx >= 0 ? lines.slice(specialIdx) : [];
  const benefitText = benefitLines.join("\n");
  const eventTitle = extractEventTitle(lines);

  return {
    fullText,
    lines,
    benefitLines,
    benefitText,
    specialIdx,
    eventTitle,
    eventSourceText: eventTitle || fullText,
    sourceFileName
  };
}

function extractEventTitle(lines: string[]): string {
  const labelPatterns = [/이벤트\s*명\s*[:：]?\s*(.+)$/i, /행사\s*명\s*[:：]?\s*(.+)$/i, /기획전\s*명\s*[:：]?\s*(.+)$/i];

  for (const line of lines) {
    for (const pattern of labelPatterns) {
      const match = line.match(pattern);
      if (match?.[1]?.trim()) return match[1].trim();
    }
  }

  return lines.find((line) => line.length >= 3) || "";
}
