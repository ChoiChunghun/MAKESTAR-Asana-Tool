import type { NormalizedPlanData, OpenContext, OpenEventLabel } from "@/types/parser";
import { NO_WINNER_TASK_LABELS, OPEN_EVENT_LABEL_ORDER, SNS_DATE_NOTICE_LABELS, VMD_FIXED_ITEM_COUNT, VMD_OFFLINE_LABELS } from "./constants";
import { pushUnique, stopAtNotice } from "./utils";

export function buildOpenContext(data: NormalizedPlanData, productCode: string): OpenContext {
  const eventLabels = detectOpenEvents(data.eventSourceText);
  const storyCount = countStoryItems(data);
  const hasPromoEvent = String(data.fullText || "").includes("홍보 이벤트");

  return {
    planningUrl: "",
    planningLabel: data.sourceFileName ? `업로드 파일: ${data.sourceFileName}` : "업로드된 기획서",
    storyCount,
    vmdItemCount: VMD_FIXED_ITEM_COUNT,
    venue: data.venue || "",
    compositeImageNeeded: "확인 필요",
    eventLabels,
    includePackshot: true,
    snsItems: buildSnsItems(eventLabels, hasPromoEvent),
    eventSourceText: data.eventSourceText || productCode,
    hasPromoEvent
  };
}

export function detectOpenEvents(text: string): OpenEventLabel[] {
  const normalized = normalizeText(text);
  const labels: OpenEventLabel[] = [];

  // ── 특전 ──────────────────────────────────────────────────────────────────
  if (/(증정|특전|포토카드|포카|온라인\s*럭키드로우|online\s*lucky\s*draw|스페셜\s*기프트|special\s*gift|benefit|photocard|gift)/i.test(normalized)) {
    pushUnique(labels, "특전");
  }

  // ── 쇼케이스 초대 ──────────────────────────────────────────────────────────
  if (/(쇼케이스|showcase|초대|invite)/i.test(normalized)) {
    pushUnique(labels, "쇼케이스 초대");
  }

  // ── 투샷회 ────────────────────────────────────────────────────────────────
  if (/(투샷회|two\s*shot|two-shot|2\s*shot|2-shot)/i.test(normalized)) {
    pushUnique(labels, "투샷회");
  }

  // ── 영통 1 / 영통 2 ────────────────────────────────────────────────────────
  // Meet&Call / 밋앤콜: 대면 + 영통 1 동시 적용 (영상통화+대면 복합 이벤트)
  const isMeetAndCall = /(밋\s*앤\s*콜|meet\s*[&＆]\s*call|meet\s*and\s*call)/i.test(normalized);
  if (isMeetAndCall) {
    pushUnique(labels, "대면");
    pushUnique(labels, "영통 1");
  }

  // 영상통화 / 영통 키워드 등장 횟수로 영통 1/2 구분
  const vcMatches = normalized.match(/(영상통화|영통|video\s*call|video-call|videocall|\bcall\b)/gi) || [];
  const vcCount = vcMatches.length + (isMeetAndCall ? 1 : 0);
  if (vcCount >= 1) pushUnique(labels, "영통 1");
  if (vcCount >= 2) pushUnique(labels, "영통 2");

  // "콜" 단독 사용 (&콜, 콜 이벤트, 콜 팬사인회)
  if (!isMeetAndCall && /(?:&\s*콜|콜\s*이벤트|콜\s*팬사인회)/.test(normalized)) {
    pushUnique(labels, "영통 1");
  }

  // ── 대면 ─────────────────────────────────────────────────────────────────
  if (/(팬사인회|팬미팅|대면|밋|meet|fansign|fanmeeting|fan\s*meeting|fan\s*sign)/i.test(normalized)) {
    pushUnique(labels, "대면");
  }

  // ── 포토회 ────────────────────────────────────────────────────────────────
  if (/(1\s*:\s*1\s*포토회|1대1\s*포토회|포토회|1\s*:\s*1\s*photo|1\s*to\s*1\s*photo|\bphoto\b)/i.test(normalized)) {
    pushUnique(labels, "포토");
  }

  // ── 오프라인 이벤트 ───────────────────────────────────────────────────────
  if (/(베이커리|게임회|bakery|\bgame\b)/i.test(normalized)) {
    pushUnique(labels, "오프라인 이벤트");
  }

  // ── 오프라인 럭키드로우 ───────────────────────────────────────────────────
  if (/(오프라인\s*럭키드로우|offline\s*lucky\s*draw)/i.test(normalized)) {
    pushUnique(labels, "오프라인 럭키드로우");
  }

  // ── 펀딩 ──────────────────────────────────────────────────────────────────
  if (/(펀딩|funding)/i.test(normalized)) pushUnique(labels, "펀딩");

  // ── 일반 판매 ─────────────────────────────────────────────────────────────
  if (/(상품|기획전)/.test(normalized)) pushUnique(labels, "일반 판매");

  // ── 파생 ──────────────────────────────────────────────────────────────────
  if (/보류/.test(normalized)) pushUnique(labels, "파생");

  // ── 기타 (fallback) ───────────────────────────────────────────────────────
  if (labels.length === 0) labels.push("기타");
  return sortLabels(labels);
}

export function countStoryItems(data: NormalizedPlanData): number {
  let count = 0;
  const lines = stopAtNotice(data.benefitLines);
  for (const line of lines) {
    for (const rawLine of String(line || "").split(/\r?\n/)) {
      if (isStoryLine(rawLine.trim())) count++;
    }
  }
  return count;
}

export function isStoryLine(line: string): boolean {
  const raw = String(line || "").trim();
  if (!raw) return false;
  if (/^For\.\s*.+/i.test(raw)) return true;
  const normalized = raw.replace(/[★☆◆◇■□※]/g, " ").replace(/\s+/g, " ").trim();
  return /^SPECIAL\s+(?:GIFT|EVENT)(?:\s+\d+)?$/i.test(normalized);
}

export function buildSnsItems(labels: OpenEventLabel[], hasPromoEvent: boolean): string[] {
  const items = ["메인"];
  if (hasPromoEvent) {
    items.push("홍보이벤트 / 국");
    items.push("홍보이벤트 / 영");
  }
  const needsDateNotice = labels.some((l) => SNS_DATE_NOTICE_LABELS.includes(l));
  if (needsDateNotice) items.push("이벤트 일정 안내");

  if (labels.length >= 2) {
    items.push("특전 / 이벤트 A");
    items.push("특전 / 이벤트 B");
  } else {
    items.push("특전");
  }
  return items;
}

/** 진행장소에 따라 VMD 서브태스크 이름 결정 */
export function resolveVmdSubName(productCode: string, venue: string, defaultCount: number): string {
  const norm = (venue || "").replace(/\s/g, "");
  if (norm.includes("드림홀")) return `[${productCode}] VMD / 1종`;
  if (norm.includes("스페이스강남")) return `[${productCode}] VMD / 6종`;
  if (norm.includes("스페이스상하이")) return `[${productCode}] VMD / 5종`;
  if (norm.includes("스페이스광저우")) return `[${productCode}] VMD / 2종`;
  if (norm.includes("스페이스심천")) return `[${productCode}] VMD / 3종`;
  return `[${productCode}] VMD / (${defaultCount})종`;
}

export function shouldCreateVmdTask(labels: OpenEventLabel[]): boolean {
  return VMD_OFFLINE_LABELS.some((l) => labels.includes(l as OpenEventLabel));
}

/**
 * 당첨자 선정 태스크 기본값 ON 여부.
 * - "특전 증정 / 펀딩 / 일반 판매 / 파생" 만으로 구성된 이벤트 → OFF (당첨자 선정 불필요)
 * - 영통·대면·쇼케이스·투샷 등 응모/추첨 이벤트가 하나라도 있으면 → ON
 */
export function shouldCreateWinnerTask(labels: OpenEventLabel[]): boolean {
  if (labels.length === 0) return false;
  // 모든 레이블이 "당첨자 불필요" 목록에 해당하면 OFF
  const isSpecialGiftOnly = labels.every((l) => (NO_WINNER_TASK_LABELS as readonly string[]).includes(l));
  return !isSpecialGiftOnly;
}

function normalizeText(text: string): string {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[／]/g, "/")
    .replace(/["""']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sortLabels(labels: OpenEventLabel[]): OpenEventLabel[] {
  return OPEN_EVENT_LABEL_ORDER.filter((l) => labels.includes(l));
}
