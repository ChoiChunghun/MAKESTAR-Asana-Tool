import type { NormalizedPlanData, ParsedPlanResult, PreviewTaskRow } from "@/types/parser";
import { buildSectionName, buildDueSummary } from "./parseDeadline";
import { parseBenefits } from "./parseBenefits";
import { parsePhotocards } from "./parsePhotocards";
import { parseProductCode } from "./parseProductCode";
import { buildOpenContext, shouldCreateVmdTask, shouldCreateWinnerAnnouncementTask } from "./parseOpenContext";

export const TEMP_PRODUCT_CODE = "상품코드_확인필요";

export function buildPreviewData(data: NormalizedPlanData, now = new Date()): ParsedPlanResult {
  const detectedProductCode = parseProductCode(data);
  const productCode = detectedProductCode || TEMP_PRODUCT_CODE;

  const photocards = parsePhotocards(data);
  const benefits = parseBenefits(data);
  const openContext = buildOpenContext(data, productCode);
  const dueSummary = buildDueSummary(data, now);
  const sectionName = buildSectionName(data, productCode, now);
  const photocardTotal = photocards.reduce((sum, item) => sum + item.count, 0);
  const benefitTotal = benefits.reduce((sum, item) => sum + item.count, 0);
  const hasMd = photocards.length > 0 || benefits.length > 0;
  const createVmdTask = shouldCreateVmdTask(openContext.eventLabels);
  const createWinnerAnnouncementTask = shouldCreateWinnerAnnouncementTask(openContext.eventLabels);
  const outputCount = photocards.length + benefits.length;

  const previewRows: PreviewTaskRow[] = [
    {
      key: "winner",
      label: "당첨자 선정",
      title: `[${productCode}] 당첨자 선정`,
      indent: 0,
      isParent: true,
      available: createWinnerAnnouncementTask,
      enabled: createWinnerAnnouncementTask,
      unavailableReason: createWinnerAnnouncementTask ? undefined : "이벤트 구분이 특전만 있어 생성하지 않습니다."
    },
    {
      key: "vmd",
      label: "VMD",
      title: `[${productCode}] VMD`,
      indent: 0,
      isParent: true,
      available: createVmdTask,
      enabled: createVmdTask,
      unavailableReason: createVmdTask ? undefined : "오프라인/대면 계열 이벤트가 없어 생성하지 않습니다."
    },
    {
      key: "vmdsub",
      label: "└ VMD 상세",
      title: `[${productCode}] VMD / (${openContext.vmdItemCount})종`,
      indent: 1,
      isParent: false,
      parentKey: "vmd",
      available: createVmdTask,
      enabled: createVmdTask
    },
    {
      key: "md",
      label: "MD",
      title: `[${productCode}] MD`,
      indent: 0,
      isParent: true,
      available: hasMd,
      enabled: hasMd,
      unavailableReason: hasMd ? undefined : "포토카드/특전 항목을 찾지 못했습니다."
    },
    {
      key: "pc",
      label: "└ 포토카드",
      title: `[${productCode}] 포토카드 / ${photocards.length}세트 총 ${photocardTotal}종`,
      indent: 1,
      isParent: false,
      parentKey: "md",
      available: photocards.length > 0,
      enabled: photocards.length > 0
    },
    {
      key: "sp",
      label: "└ 특전",
      title: `[${productCode}] 특전 / ${benefits.length}종 총 ${benefitTotal}종`,
      indent: 1,
      isParent: false,
      parentKey: "md",
      available: benefits.length > 0,
      enabled: benefits.length > 0
    },
    {
      key: "up",
      label: "업데이트",
      title: `[${productCode}] 업데이트`,
      indent: 0,
      isParent: true,
      available: hasMd,
      enabled: hasMd,
      unavailableReason: hasMd ? undefined : "업데이트 산출물 기준이 되는 포토카드/특전 항목이 없습니다."
    },
    {
      key: "upsub",
      label: "└ 업데이트 상세",
      title: `[${productCode}] 업데이트 / ${outputCount}종`,
      indent: 1,
      isParent: false,
      parentKey: "up",
      available: hasMd,
      enabled: hasMd
    },
    {
      key: "open",
      label: "오픈",
      title: `[${productCode}] 오픈`,
      indent: 0,
      isParent: true,
      available: true,
      enabled: true
    },
    {
      key: "opendesign",
      label: "└ 오픈 디자인",
      title: `[${productCode}] 오픈 디자인`,
      indent: 1,
      isParent: false,
      parentKey: "open",
      available: true,
      enabled: true
    }
  ];

  return {
    normalizedData: data,
    openContext,
    summary: {
      productCode,
      productCodeDetected: Boolean(detectedProductCode),
      eventTitle: data.eventTitle,
      eventLabels: openContext.eventLabels,
      deadlineIso: dueSummary.deadlineIso,
      sectionName,
      photocards,
      benefits,
      photocardTotal,
      benefitTotal,
      storyCount: openContext.storyCount,
      snsItems: openContext.snsItems,
      createVmdTask,
      createWinnerAnnouncementTask,
      dueSummary
    },
    previewRows
  };
}
