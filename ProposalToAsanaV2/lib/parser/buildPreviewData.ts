import type { NormalizedPlanData, ParsedPlanResult, PreviewTaskRow } from "@/types/parser";
import { buildSectionName, buildDueSummary } from "./parseDeadline";
import { parseBenefits } from "./parseBenefits";
import { parsePhotocards } from "./parsePhotocards";
import { buildOpenContext, resolveVmdSubName, shouldCreateVmdTask, shouldCreateWinnerTask } from "./parseOpenContext";
import { generateRandomCode } from "./utils";

export function buildPreviewData(data: NormalizedPlanData, now = new Date()): ParsedPlanResult {
  const artistName = data.artistName || "";
  const tempCode = artistName
    ? `${artistName} 추후 일괄 변경`
    : "추후 일괄 변경";

  const productCode = tempCode;
  const photocards = parsePhotocards(data);
  const benefits = parseBenefits(data);
  const openContext = buildOpenContext(data, productCode);
  const dueSummary = buildDueSummary(data, now);
  const sectionName = buildSectionName(data, productCode, now);
  const photocardTotal = photocards.reduce((s, i) => s + i.count, 0);
  const benefitTotal = benefits.reduce((s, i) => s + i.count, 0);
  const hasMd = photocards.length > 0 || benefits.length > 0;
  const createVmdTask = shouldCreateVmdTask(openContext.eventLabels);
  const createWinnerAnnouncementTask = shouldCreateWinnerTask(openContext.eventLabels);
  const outputCount = photocards.length + benefits.length;

  const previewRows: PreviewTaskRow[] = [
    {
      key: "winner",
      label: "당첨자 선정",
      title: `[${productCode}] 당첨자 선정`,
      indent: 0,
      isParent: true,
      available: true,
      enabled: createWinnerAnnouncementTask
    },
    {
      key: "md",
      label: "MD",
      title: `[${productCode}] MD`,
      indent: 0,
      isParent: true,
      available: true,           // 항상 토글 가능
      enabled: hasMd             // 포카/특전 파싱 시 기본 ON
    },
    {
      key: "pc",
      label: "└ 포토카드",
      title: `[${productCode}] 포토카드 / ${photocards.length}세트 총 ${photocardTotal}종`,
      indent: 1,
      isParent: false,
      parentKey: "md",
      available: true,
      enabled: photocards.length > 0
    },
    {
      key: "sp",
      label: "└ 특전",
      title: benefits.length > 0
        ? `[${productCode}] 특전 / ${benefits.length}종 총 ${benefitTotal}종`
        : `[${productCode}] 특전`,
      indent: 1,
      isParent: false,
      parentKey: "md",
      available: true,
      enabled: benefits.length > 0
    },
    {
      key: "vmd",
      label: "VMD",
      title: `[${productCode}] VMD`,
      indent: 0,
      isParent: true,
      available: true,
      enabled: createVmdTask
    },
    {
      key: "vmdsub",
      label: "└ VMD 상세",
      title: resolveVmdSubName(productCode, openContext.venue, openContext.vmdItemCount),
      indent: 1,
      isParent: false,
      parentKey: "vmd",
      available: true,
      enabled: createVmdTask
    },
    {
      key: "up",
      label: "업데이트",
      title: `[${productCode}] 업데이트`,
      indent: 0,
      isParent: true,
      available: true,
      enabled: hasMd
    },
    {
      key: "upsub",
      label: "└ 업데이트 상세",
      title: `[${productCode}] 업데이트 / ${outputCount}종`,
      indent: 1,
      isParent: false,
      parentKey: "up",
      available: true,
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
    },
    // ── 상품 등록 관련 서브태스크 (SNS 오픈=파생모드 제외, 플랫폼별 구분) ──
    {
      key: "sitelang",
      label: "└ 시트 언어 검수",
      title: `[${productCode}] 시트 언어 검수`,
      indent: 1,
      isParent: false,
      parentKey: "open",
      // 웨이디엔은 시트 언어 검수 없음; 미리보기에서 비활성 표시
      available: !openContext.isYdn,
      enabled: !openContext.isYdn,
      unavailableReason: openContext.isYdn ? "웨이디엔 오픈에는 해당 없음" : undefined
    },
    {
      key: "adminreg",
      label: openContext.isYdn ? "└ YDN 어드민 등록·검수" : "└ 어드민 상품 등록",
      title: openContext.isYdn
        ? `[${productCode}] 웨이디엔 어드민 상품 등록 및 검수`
        : `[${productCode}] 어드민 상품 등록`,
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
      productCodeDetected: false,
      eventTitle: data.eventTitle,
      artistName: data.artistName,
      albumName: data.albumName,
      eventLabels: openContext.eventLabels,
      deadlineIso: dueSummary.deadlineIso,
      winnerAnnouncementIso: dueSummary.winnerAnnouncementIso,
      sectionName,
      photocards,
      benefits,
      photocardTotal,
      benefitTotal,
      storyCount: openContext.storyCount,
      snsItems: openContext.snsItems,
      createVmdTask,
      createWinnerAnnouncementTask,
      dueSummary,
      venue: openContext.venue ?? "",
      applicationStartIso: data.applicationStartIso ?? null
    },
    previewRows
  };
}
