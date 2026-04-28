import type { NormalizedPlanData, OpenContext, OpenEventLabel } from "@/types/parser";
import { OPEN_EVENT_LABEL_ORDER, VMD_FIXED_ITEM_COUNT } from "./constants";
import { pushUnique, stopAtNotice } from "./utils";

export function buildOpenContext(data: NormalizedPlanData, productCode: string): OpenContext {
  const eventLabels = detectOpenEvents(data.eventSourceText);
  const storyCount = countOpenStoryItems(data);

  return {
    planningUrl: "",
    planningLabel: data.sourceFileName ? `업로드 PDF: ${data.sourceFileName}` : "업로드된 PDF 기획서",
    storyCount,
    vmdItemCount: VMD_FIXED_ITEM_COUNT,
    compositeImageNeeded: "확인 필요",
    eventLabels,
    includePackshot: true,
    snsItems: buildOpenSnsItems(data.fullText, eventLabels),
    eventSourceText: data.eventSourceText || productCode
  };
}

export function countOpenStoryItems(data: NormalizedPlanData): number {
  let count = 0;
  const lines = stopAtNotice(data.benefitLines);

  for (const cell of lines) {
    for (const rawLine of String(cell || "").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (isOpenStoryLine(line)) count += 1;
    }
  }

  return count;
}

export function isOpenStoryLine(line: string): boolean {
  const raw = String(line || "").trim();
  if (!raw) return false;

  if (/^For\.\s*.+/i.test(raw)) {
    return true;
  }

  const normalized = raw
    .replace(/[★☆◆◇■□※]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /^SPECIAL\s+(?:GIFT|EVENT)(?:\s+\d+)?$/i.test(normalized);
}

export function detectOpenEvents(text: string): OpenEventLabel[] {
  const normalized = normalizeOpenEventText(text);
  const labels: OpenEventLabel[] = [];

  if (/(증정|특전|포토카드|포카|온라인\s*럭키드로우|online\s*lucky\s*draw|스페셜\s*기프트|special\s*gift|benefit|photocard|gift)/i.test(normalized)) {
    pushUnique(labels, "특전");
  }

  if (/(쇼케이스|showcase|초대|invite)/i.test(normalized)) {
    pushUnique(labels, "쇼케이스 초대");
  }

  if (/(투샷회|two\s*shot|two-shot|2\s*shot|2-shot)/i.test(normalized)) {
    pushUnique(labels, "투샷회");
  }

  const vcCount = countKeywordOccurrences(normalized, /(영상통화|영통|video\s*call|video-call|videocall)/gi);
  if (vcCount >= 1) pushUnique(labels, "영통 1");
  if (vcCount >= 2) pushUnique(labels, "영통 2");

  if (/(팬사인회|팬미팅|대면|밋|meet|fansign|fanmeeting|fan\s*meeting|fan\s*sign)/i.test(normalized)) {
    pushUnique(labels, "대면");
  }

  if (/(1\s*:\s*1\s*포토회|1대1\s*포토회|포토회|1\s*:\s*1\s*photo|1\s*to\s*1\s*photo|photo\s*event)/i.test(normalized)) {
    pushUnique(labels, "포토");
  }

  if (/(베이커리|게임회|bakery|game\s*event|game\s*meeting)/i.test(normalized)) {
    pushUnique(labels, "오프라인 이벤트");
  }

  if (/(오프라인\s*럭키드로우|offline\s*lucky\s*draw)/i.test(normalized)) {
    pushUnique(labels, "오프라인 럭키드로우");
  }

  if (/(펀딩|funding)/i.test(normalized)) {
    pushUnique(labels, "펀딩");
  }

  if (/(상품|기획전)/i.test(normalized)) {
    pushUnique(labels, "일반 판매");
  }

  if (/(웨이디엔)/i.test(normalized)) {
    pushUnique(labels, "파생");
  }

  if (labels.length === 0) labels.push("기타");

  return sortOpenEventLabels(labels);
}

export function buildOpenSnsItems(fullText: string, eventLabels: OpenEventLabel[]): string[] {
  const items = ["메인"];
  if (String(fullText || "").includes("홍보 이벤트")) {
    items.push("홍보이벤트 / 국");
    items.push("홍보이벤트 / 영");
  }
  if (eventLabels.includes("대면") || eventLabels.includes("쇼케이스 초대")) {
    items.push("이벤트 일정 안내");
  }
  if (eventLabels.length >= 2) {
    items.push("특전 / 이벤트 A");
    items.push("특전 / 이벤트 B");
  } else {
    items.push("특전");
  }
  return items;
}

export function sortOpenEventLabels(labels: OpenEventLabel[]): OpenEventLabel[] {
  return OPEN_EVENT_LABEL_ORDER.filter((label) => labels.includes(label));
}

export function shouldCreateVmdTask(labels: OpenEventLabel[]): boolean {
  return ["쇼케이스 초대", "대면", "포토", "오프라인 이벤트", "오프라인 럭키드로우"].some((label) =>
    labels.includes(label as OpenEventLabel)
  );
}

export function shouldCreateWinnerAnnouncementTask(labels: OpenEventLabel[]): boolean {
  return !(labels.length === 1 && labels[0] === "특전");
}

function normalizeOpenEventText(text: string): string {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[／]/g, "/")
    .replace(/[“”"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countKeywordOccurrences(text: string, regex: RegExp): number {
  const matches = String(text).match(regex);
  return matches ? matches.length : 0;
}
