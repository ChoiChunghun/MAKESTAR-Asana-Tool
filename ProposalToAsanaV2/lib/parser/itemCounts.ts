import type { ParsedItem } from "@/types/parser";

export function formatItemCount(item: ParsedItem): string {
  return item.countLabel?.trim() || `${item.count}종`;
}

export function formatTotalCount(total: number, needsReview = false): string {
  return needsReview ? "수량 확인 필요" : `${total}종`;
}

export function mergeParsedItemCount(current: ParsedItem, next: ParsedItem): Pick<ParsedItem, "count" | "countLabel"> {
  const currentNeedsReview = !!current.countLabel;
  const nextNeedsReview = !!next.countLabel;

  if (!currentNeedsReview && !nextNeedsReview) {
    return { count: Math.max(current.count, next.count) };
  }
  if (!currentNeedsReview) {
    return { count: current.count };
  }
  if (!nextNeedsReview) {
    return { count: next.count };
  }

  return {
    count: Math.max(current.count, next.count),
    countLabel: current.countLabel || next.countLabel || "수량 확인 필요"
  };
}
