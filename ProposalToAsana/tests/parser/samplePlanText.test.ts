import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPdfData } from "@/lib/pdf/buildPdfData";
import { buildPreviewData, TEMP_PRODUCT_CODE } from "@/lib/parser/buildPreviewData";
import { parseApplicationDeadlineIsoDate, parseEventStartDate } from "@/lib/parser/parseDeadline";
import { parseBenefits } from "@/lib/parser/parseBenefits";
import { parsePhotocards } from "@/lib/parser/parsePhotocards";
import { parseProductCode } from "@/lib/parser/parseProductCode";

const fixturePath = join(process.cwd(), "tests/fixtures/sample-plan-text.txt");
const sampleText = readFileSync(fixturePath, "utf8");
const fixedNow = new Date("2026-04-17T10:00:00+09:00");

describe("sample PDF text parser", () => {
  it("keeps Apps Script parsing rules on normalized PDF text", () => {
    const data = buildPdfData(sampleText, "sample-plan.pdf");
    const preview = buildPreviewData(data, fixedNow);

    expect(parseProductCode(data)).toBe("P_20260417ABC");
    expect(parseApplicationDeadlineIsoDate(data, fixedNow)).toBe("2026-04-20");
    expect(parseEventStartDate(data, fixedNow)).toBe("04/01");
    expect(parsePhotocards(data)).toEqual([
      { name: "미공개 셀카 포토카드", count: 5 },
      { name: "럭키드로우 포토카드", count: 6 }
    ]);
    expect(parseBenefits(data)).toEqual([
      { name: "손글씨 메시지 카드", count: 2 },
      { name: "아크릴 키링", count: 1 }
    ]);
    expect(preview.summary.eventLabels).toEqual(["특전", "영통 1", "대면"]);
    expect(preview.summary.storyCount).toBe(2);
    expect(preview.summary.snsItems).toEqual(["메인", "홍보이벤트 / 국", "홍보이벤트 / 영", "이벤트 일정 안내", "특전 / 이벤트 A", "특전 / 이벤트 B"]);
    expect(preview.summary.createVmdTask).toBe(true);
    expect(preview.summary.createWinnerAnnouncementTask).toBe(true);
    expect(preview.summary.sectionName).toBe("04/01 P_20260417ABC");
    expect(preview.summary.dueSummary.open).toEqual({ due_at: "2026-04-20T13:00:00+09:00" });
    expect(preview.summary.dueSummary.update).toEqual({ due_on: "2026-04-19" });
    expect(preview.previewRows.some((row) => row.key === "opendesign" && row.enabled)).toBe(true);
  });

  it("uses a temporary product code when PDF text has no product code", () => {
    const textWithoutProductCode = sampleText
      .replace("상품코드: P_20260417ABC\n\n", "")
      .replace(/P_20260417ABC/g, "");
    const data = buildPdfData(textWithoutProductCode, "no-product-code.pdf");
    const preview = buildPreviewData(data, fixedNow);

    expect(parseProductCode(data)).toBeNull();
    expect(preview.summary.productCode).toBe(TEMP_PRODUCT_CODE);
    expect(preview.summary.productCodeDetected).toBe(false);
    expect(preview.summary.sectionName).toBe(`04/01 ${TEMP_PRODUCT_CODE}`);
    expect(preview.previewRows.find((row) => row.key === "open")?.title).toBe(`[${TEMP_PRODUCT_CODE}] 오픈`);
  });
});
