import type {
  BenefitCardType,
  BenefitEffect,
  BenefitItem,
  BenefitType,
  BenefitValue,
  ConditionGroup,
  ProposalData,
  ProposalLanguage,
  ProposalRange,
  ProposalSourceMap,
  ReviewFlag,
  SheetRow
} from "../types";

type ParsedField = {
  value?: string;
  refs: string[];
};

type ParserContext = {
  rows: SheetRow[];
  rawText: string;
  reviewFlags: Set<ReviewFlag>;
  sourceMap: ProposalSourceMap;
};

const PRODUCT_CODE_REGEXES = [
  /상품\s*코드[:：]?\s*([A-Z0-9_-]+)/i,
  /\b([A-Z]{2,}[-_]?\d{3,}[A-Z0-9_-]*)\b/
];

const BENEFIT_SECTION_START_REGEX = /메이크스타\s*특전|특전|benefit/i;
const BENEFIT_ITEM_REGEX =
  /메이크스타\s*특전|특전|benefit|포토카드|photocard|lucky\s*draw|럭드|폴라로이드|polaroid|사인|signed|스티커|l-holder|l홀더|아크릴|키링|코스터|홀로그램|렌티큘러|클리어|메시지|drawing|드로잉|album|영상통화|팬사인|사인회|쇼케이스|하이터치|이벤트/i;
const BENEFIT_STOP_REGEX = /III\.\s*수급|수급\s*리스트|구매\s*수량|주문\s*수량|신청\s*수량/i;
const CONDITION_REGEX = /조건|응모\s*방법|구매\s*조건|참여\s*방법|유의\s*사항/i;

const SCHEDULE_LABELS = {
  salesPeriod: [/판매\s*기간/i],
  applyPeriod: [/응모\s*기간/i, /신청\s*기간/i],
  eventDate: [/이벤트\s*기간/i, /행사일/i, /진행일시/i, /event\s*date/i],
  winnerDate: [/당첨자\s*발표/i]
} as const;

const NEXT_LABEL_REGEX = new RegExp(
  [
    "판매\\s*기간",
    "응모\\s*기간",
    "신청\\s*기간",
    "이벤트\\s*기간",
    "행사일",
    "진행일시",
    "당첨자\\s*발표",
    "아티스트",
    "artist",
    "앨범",
    "album",
    "상품명",
    "채널",
    "특전",
    "조건"
  ].join("|"),
  "i"
);

export function buildProposalData(input: {
  spreadsheetId: string;
  sheetName: string;
  range: ProposalRange;
  rows: SheetRow[];
}): ProposalData {
  const rows = input.rows.length ? input.rows : [{ rowNumber: 1, value: "", sourceRef: `${input.sheetName}!B1` }];
  const rawText = rows.map((row) => row.value).join("\n");
  const reviewFlags = new Set<ReviewFlag>();
  const sourceMap = createEmptySourceMap();
  const context: ParserContext = {
    rows,
    rawText,
    reviewFlags,
    sourceMap
  };

  const productCode = parseProductCode(context);
  const eventTitle = parseEventTitle(context);
  const { artistName, albumName } = parseArtistAlbum(context, eventTitle);
  const schedule = parseSchedule(context);
  const benefits = parseBenefits(context);
  const conditionGroups = parseConditionGroups(context, benefits);
  const channels = parseChannels(rawText, sourceMap, rows);
  const designHints = parseDesignHints(rows, rawText, sourceMap);
  const eventType = parseEventType(rawText);

  if (!schedule.salesPeriod && !schedule.applyPeriod && !schedule.eventDate) {
    reviewFlags.add("PERIOD_NOT_FOUND");
  }

  if (!benefits.length) {
    reviewFlags.add("BENEFIT_NOT_FOUND");
  }

  return {
    sourceSpreadsheetId: input.spreadsheetId,
    sourceSheetName: input.sheetName,
    sourceRange: input.range,
    rawRows: rows,
    rawText,
    productCode,
    eventTitle,
    artistName,
    albumName,
    eventType,
    schedule,
    benefits,
    conditionGroups,
    channels,
    designHints,
    sourceMap,
    reviewFlags: [...reviewFlags]
  };
}

function createEmptySourceMap(): ProposalSourceMap {
  return {
    basicInfo: [],
    schedule: [],
    benefits: [],
    conditions: [],
    channels: [],
    designHints: []
  };
}

function normalizeWhitespace(value: string): string {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pushRefs(target: string[], refs: string[]): void {
  for (const ref of refs) {
    if (!target.includes(ref)) {
      target.push(ref);
    }
  }
}

function pushRowRef(target: string[], row?: SheetRow): void {
  if (row?.sourceRef && !target.includes(row.sourceRef)) {
    target.push(row.sourceRef);
  }
}

function parseProductCode(context: ParserContext): string {
  for (const row of context.rows) {
    const value = normalizeWhitespace(row.value);
    if (!value) {
      continue;
    }
    for (const pattern of PRODUCT_CODE_REGEXES) {
      const match = value.match(pattern);
      if (!match?.[1]) {
        continue;
      }
      pushRowRef(context.sourceMap.basicInfo, row);
      return match[1];
    }
  }

  context.reviewFlags.add("PRODUCT_CODE_NOT_FOUND");
  return "UNKNOWN_PRODUCT";
}

function parseEventTitle(context: ParserContext): string {
  const topRows = context.rows.filter((row) => normalizeWhitespace(row.value)).slice(0, 10);
  const titlePatterns = [
    /(이벤트명|행사명|프로모션명)\s*[:：]?\s*(.+)$/i,
    /\bEVENT\b\s*[:：]?\s*(.+)$/i
  ];

  for (let index = 0; index < topRows.length; index += 1) {
    const row = topRows[index];
    if (!row) {
      continue;
    }
    const value = normalizeWhitespace(row.value);
    for (const pattern of titlePatterns) {
      const match = value.match(pattern);
      if (match?.[2]) {
        pushRowRef(context.sourceMap.basicInfo, row);
        return match[2].trim();
      }
    }

    if (/^(이벤트명|행사명|프로모션명|EVENT)$/i.test(value)) {
      const nextRow = topRows[index + 1];
      if (nextRow && normalizeWhitespace(nextRow.value)) {
        pushRefs(context.sourceMap.basicInfo, [row.sourceRef, nextRow.sourceRef]);
        return normalizeWhitespace(nextRow.value);
      }
    }
  }

  const fallback = topRows
    .map((row) => ({ row, value: normalizeWhitespace(row.value) }))
    .filter(({ value }) => value.length >= 6 && !/^(아티스트|artist|앨범|album|상품\s*코드)$/i.test(value))
    .sort((a, b) => b.value.length - a.value.length)[0];

  if (fallback) {
    pushRowRef(context.sourceMap.basicInfo, fallback.row);
    return fallback.value;
  }

  context.reviewFlags.add("EVENT_TITLE_NOT_FOUND");
  return "Untitled Event";
}

function parseArtistAlbum(
  context: ParserContext,
  eventTitle: string
): {
  artistName: string;
  albumName: string;
} {
  const artistField = extractFieldNearLabels(context.rows, [/^아티스트$/i, /^artist$/i, /^artist\s*name$/i, /^아티스트[:：]/i, /^artist[:：]/i]);
  const albumField = extractFieldNearLabels(context.rows, [/^앨범$/i, /^album$/i, /^상품명$/i, /^앨범[:：]/i, /^album[:：]/i, /^상품명[:：]/i]);

  let artistName = artistField.value?.trim() ?? "";
  let albumName = albumField.value?.trim() ?? "";

  if (artistName) {
    pushRefs(context.sourceMap.basicInfo, artistField.refs);
  }
  if (albumName) {
    pushRefs(context.sourceMap.basicInfo, albumField.refs);
  }

  if (!artistName || !albumName) {
    const fallbackSource = albumField.value || eventTitle;
    const inferred = inferArtistAlbum(fallbackSource);
    if (!artistName && inferred.artistName) {
      artistName = inferred.artistName;
    }
    if (!albumName && inferred.albumName) {
      albumName = inferred.albumName;
    }
    context.reviewFlags.add("ARTIST_ALBUM_INFERRED");
  }

  return {
    artistName,
    albumName
  };
}

function extractFieldNearLabels(rows: SheetRow[], patterns: RegExp[]): ParsedField {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row) {
      continue;
    }
    const value = normalizeWhitespace(row.value);
    if (!value) {
      continue;
    }

    for (const pattern of patterns) {
      if (!pattern.test(value)) {
        continue;
      }

      const inlineValue = extractInlineLabelValue(value);
      if (inlineValue) {
        return {
          value: inlineValue,
          refs: [row.sourceRef]
        };
      }

      const nextRows = rows.slice(index + 1, index + 4).filter((candidate) => normalizeWhitespace(candidate.value));
      const nextRow = nextRows.find((candidate) => !NEXT_LABEL_REGEX.test(normalizeWhitespace(candidate.value)));
      if (nextRow) {
        return {
          value: normalizeWhitespace(nextRow.value),
          refs: [row.sourceRef, nextRow.sourceRef]
        };
      }
    }
  }

  return { refs: [] };
}

function extractInlineLabelValue(value: string): string | undefined {
  const match = value.match(/^[^:：]+[:：]\s*(.+)$/);
  return match?.[1]?.trim();
}

function inferArtistAlbum(source: string): { artistName: string; albumName: string } {
  const normalized = normalizeWhitespace(source);
  const delimiterMatch = normalized.match(/^(.+?)\s*(?:[-/|]|:)\s*(.+)$/);
  if (delimiterMatch?.[1] && delimiterMatch[2]) {
    return {
      artistName: delimiterMatch[1].trim(),
      albumName: delimiterMatch[2].trim()
    };
  }

  const quotedAlbum = normalized.match(/["'“](.+?)["'”]/);
  if (quotedAlbum?.[1]) {
    const artistName = normalized.replace(quotedAlbum[0], "").replace(/\b(event|special|fan sign|fansign)\b/gi, "").trim();
    return {
      artistName,
      albumName: quotedAlbum[1].trim()
    };
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length >= 3) {
    return {
      artistName: tokens.slice(0, Math.min(2, tokens.length - 1)).join(" "),
      albumName: tokens.slice(Math.min(2, tokens.length - 1)).join(" ")
    };
  }

  return {
    artistName: normalized,
    albumName: ""
  };
}

function parseSchedule(context: ParserContext): ProposalData["schedule"] {
  return {
    salesPeriod: extractScheduleField(context, SCHEDULE_LABELS.salesPeriod),
    applyPeriod: extractScheduleField(context, SCHEDULE_LABELS.applyPeriod),
    eventDate: extractScheduleField(context, SCHEDULE_LABELS.eventDate),
    winnerDate: extractScheduleField(context, SCHEDULE_LABELS.winnerDate)
  };
}

function extractScheduleField(context: ParserContext, patterns: readonly RegExp[]): string | undefined {
  for (let index = 0; index < context.rows.length; index += 1) {
    const row = context.rows[index];
    if (!row) {
      continue;
    }
    const value = normalizeWhitespace(row.value);
    if (!value) {
      continue;
    }

    const matches = patterns.some((pattern) => pattern.test(value));
    if (!matches) {
      continue;
    }

    const refs = [row.sourceRef];
    const inlineValue = extractInlineLabelValue(value);
    if (inlineValue) {
      pushRefs(context.sourceMap.schedule, refs);
      return inlineValue;
    }

    const parts: string[] = [];
    for (let offset = 1; offset <= 3; offset += 1) {
      const candidate = context.rows[index + offset];
      if (!candidate) {
        break;
      }
      const nextValue = normalizeWhitespace(candidate.value);
      if (!nextValue) {
        continue;
      }
      if (NEXT_LABEL_REGEX.test(nextValue) && parts.length > 0) {
        break;
      }
      if (NEXT_LABEL_REGEX.test(nextValue) && parts.length === 0) {
        break;
      }
      refs.push(candidate.sourceRef);
      parts.push(candidate.value.trim());
      if (looksLikeCompletePeriod(parts.join(" "))) {
        break;
      }
    }

    if (parts.length) {
      pushRefs(context.sourceMap.schedule, refs);
      return parts.join(" ").trim();
    }
  }

  return undefined;
}

function looksLikeCompletePeriod(value: string): boolean {
  return /\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}.*(?:~|-|부터).*\d{1,2}[:.]\d{2}/.test(value) || /\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(value);
}

function parseBenefits(context: ParserContext): BenefitItem[] {
  const benefits: BenefitItem[] = [];
  const merged = new Map<string, number>();
  const startIndex = context.rows.findIndex((row) => BENEFIT_SECTION_START_REGEX.test(normalizeWhitespace(row.value)));
  const scanRows =
    startIndex >= 0
      ? context.rows.slice(startIndex)
      : context.rows.filter((row) => BENEFIT_ITEM_REGEX.test(normalizeWhitespace(row.value)));

  for (const row of scanRows) {
    const value = normalizeWhitespace(row.value);
    if (!value) {
      continue;
    }
    if (BENEFIT_STOP_REGEX.test(value)) {
      break;
    }
    const benefit = parseBenefitItem(row);
    if (!benefit) {
      continue;
    }

    pushRowRef(context.sourceMap.benefits, row);
    const key = [
      benefit.benefitType,
      benefit.name,
      benefit.value ?? "Null",
      benefit.effect ?? "Null",
      benefit.cardType ?? "Vertical"
    ].join("|");
    const existingIndex = merged.get(key);
    if (existingIndex !== undefined) {
      const existing = benefits[existingIndex];
      if (existing) {
        existing.count += benefit.count;
      }
      continue;
    }

    merged.set(key, benefits.length);
    benefits.push(benefit);
  }

  return benefits;
}

function parseBenefitItem(row: SheetRow): BenefitItem | null {
  const text = normalizeWhitespace(row.value);
  if (!text) {
    return null;
  }
  if (/^(메이크스타\s*특전|특전|benefit)$/i.test(text)) {
    return null;
  }

  const looksLikeBenefit = BENEFIT_ITEM_REGEX.test(text);
  if (!looksLikeBenefit) {
    return null;
  }

  const benefitType = classifyBenefitType(text);
  const count = extractBenefitCount(text, benefitType);
  const name = buildBenefitName(text);
  if (!name) {
    return null;
  }

  if (!BENEFIT_ITEM_REGEX.test(text) && count === 1 && benefitType === "Etc") {
    return null;
  }

  return {
    benefitType,
    rawText: row.value,
    name,
    count,
    setName: extractSetName(text),
    value: classifyBenefitValue(text),
    effect: classifyBenefitEffect(text),
    cardType: classifyBenefitCardType(text),
    sourceRef: row.sourceRef
  };
}

function classifyBenefitType(text: string): BenefitType {
  if (/포토카드.*세트|세트|set/i.test(text)) {
    return "Photocards";
  }
  if (/포토카드|photocard|photo card|미공포/i.test(text)) {
    return "Photocard";
  }
  if (/폴라|polaroid|pola|포토타임|photo time/i.test(text)) {
    return "Pic";
  }
  if (/영상통화|팬사인|사인회|쇼케이스|하이터치|이벤트/i.test(text)) {
    return "Event";
  }
  if (/사인지|스티커|엘홀더|l-holder|l홀더|인쇄물/i.test(text)) {
    return "Printout";
  }
  if (/사인\s*지|autograph\s*sheet/i.test(text)) {
    return "AutographSheet";
  }
  if (/아크릴|키링|그립톡|코스터/i.test(text)) {
    return "Acrylic";
  }
  if (/앨범|album/i.test(text)) {
    return "Album";
  }
  return "Etc";
}

function extractBenefitCount(text: string, benefitType: BenefitType): number {
  const patterns = [
    /(\d+)\s*종/i,
    /(\d+)\s*ea/i,
    /(\d+)\s*장/i,
    /(\d+)\s*개/i,
    /(\d+)\s*매/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return Number(match[1]);
    }
  }

  if (benefitType === "Event" || benefitType === "Pic") {
    return 1;
  }

  return 1;
}

function buildBenefitName(text: string): string {
  return text
    .replace(/^\d+\.\s*/, "")
    .replace(/^[-•★◆]\s*/, "")
    .replace(/특전\s*[:：]?\s*/gi, "")
    .replace(/메이크스타\s*특전\s*[:：]?\s*/gi, "")
    .replace(/\s*\(.*?\)\s*$/g, "")
    .replace(/\s*(\d+\s*(?:종|ea|장|개|매)).*$/i, "")
    .replace(/\s*(증정|추첨|제공|응모권).*$/i, "")
    .trim();
}

function extractSetName(text: string): string | undefined {
  const match = text.match(/([A-Za-z0-9가-힣\s]+)\s*세트/i);
  return match?.[1]?.trim();
}

function classifyBenefitValue(text: string): BenefitValue {
  if (/기명|to\.?\s*sign|to sign/i.test(text)) {
    return "ToSign";
  }
  if (/to\.?\s*msg|to msg/i.test(text)) {
    return "ToMsg";
  }
  if (/사인|signed|sign/i.test(text)) {
    return "Sign";
  }
  if (/메시지|message|msg/i.test(text)) {
    return "Msg";
  }
  if (/드로잉|drawing/i.test(text)) {
    return "Drawing";
  }
  if (/럭드|luck|lucky/i.test(text)) {
    return "Luck";
  }
  return "Null";
}

function classifyBenefitEffect(text: string): BenefitEffect {
  if (/홀로그램|hologram/i.test(text)) {
    return "Hologram";
  }
  if (/렌티큘러|lenticular/i.test(text)) {
    return "Lenticular";
  }
  if (/클리어|clear/i.test(text)) {
    return "Clear";
  }
  return "Null";
}

function classifyBenefitCardType(text: string): BenefitCardType {
  if (/가로|horizontal/i.test(text)) {
    return "Horizontal";
  }
  if (/폴라|polar|polaroid/i.test(text)) {
    return "Polar";
  }
  if (/미니|mini/i.test(text)) {
    return "Mini";
  }
  return "Vertical";
}

function parseConditionGroups(context: ParserContext, benefits: BenefitItem[]): ConditionGroup[] {
  const groups: ConditionGroup[] = [];
  const conditionRows = context.rows.filter((row) => CONDITION_REGEX.test(normalizeWhitespace(row.value)));

  for (const row of conditionRows) {
    const text = normalizeWhitespace(row.value);
    if (!text) {
      continue;
    }
    pushRowRef(context.sourceMap.conditions, row);
    groups.push({
      title: text.split(/[:：]/)[0]?.trim() || "조건",
      conditionText: text,
      items: benefits.filter((benefit) => benefit.sourceRef === row.sourceRef),
      sourceRefs: [row.sourceRef]
    });
  }

  if (groups.length > 4) {
    context.reviewFlags.add("CONDITION_GROUP_COUNT_EXCEEDED");
  }

  return groups;
}

function collectRowsByPattern(rows: SheetRow[], pattern: RegExp): string[] {
  return rows.filter((row) => pattern.test(normalizeWhitespace(row.value))).map((row) => row.sourceRef);
}

function parseChannels(rawText: string, sourceMap: ProposalSourceMap, rows: SheetRow[] = []): ProposalData["channels"] {
  const normalized = normalizeWhitespace(rawText);
  const channels = {
    makestar: /makestar|메이크스타/i.test(normalized),
    weidian: /weidian|微店|위디안|웨이디안/i.test(normalized),
    x: /(?:^|\s)(x|twitter|트위터)(?:\s|$)/i.test(normalized),
    instagram: /instagram|인스타/i.test(normalized)
  };

  pushRefs(
    sourceMap.channels,
    collectRowsByPattern(rows, /makestar|메이크스타|weidian|微店|위디안|웨이디안|instagram|인스타|twitter|트위터/i)
  );

  return channels;
}

function parseDesignHints(
  rows: SheetRow[],
  rawText: string,
  sourceMap: ProposalSourceMap
): ProposalData["designHints"] {
  const language = detectLanguage(rawText);
  const mainBgImage = rawText.match(/https?:\/\/\S+\.(?:png|jpg|jpeg|webp)/i)?.[0];
  const bgColorHex = rawText.match(/#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})\b/)?.[0];
  const conceptRow = rows.find((row) => /컨셉|콘셉트|concept/i.test(normalizeWhitespace(row.value)));
  const infoRows = rows.filter((row) =>
    /https?:\/\/|www\.|makestar|weidian|공식\s*홈페이지|판매처|사이트\s*안내|#[A-Za-z0-9가-힣_]+/i.test(
      normalizeWhitespace(row.value)
    )
  );

  if (conceptRow) {
    pushRowRef(sourceMap.designHints, conceptRow);
  }
  pushRefs(
    sourceMap.designHints,
    infoRows.map((row) => row.sourceRef)
  );

  return {
    language,
    mainBgImage,
    bgColorHex,
    conceptText: conceptRow ? normalizeWhitespace(conceptRow.value).replace(/^[^:：]+[:：]?\s*/, "") : undefined,
    hasEventHashtag: /#[A-Za-z0-9가-힣_]+/.test(rawText),
    hasSiteInfo: /https?:\/\/|www\.|makestar|weidian|공식\s*홈페이지|판매처|사이트\s*안내/i.test(rawText)
  };
}

function detectLanguage(rawText: string): ProposalLanguage {
  if (/简体|简中|中文|weidian|微店/i.test(rawText)) {
    return "SC";
  }
  if (/일본어|日本|応募|当選/i.test(rawText)) {
    return "JA";
  }
  if (/[A-Za-z]{3,}/.test(rawText) && !/[가-힣]/.test(rawText)) {
    return "EN";
  }
  return "KR";
}

function parseEventType(rawText: string): ProposalData["eventType"] {
  return {
    hasVideoCall: /영상통화|video\s*call|videocall|영통/i.test(rawText),
    hasFansign: /팬사인|fansign|fan sign/i.test(rawText),
    hasShowcase: /쇼케이스|showcase/i.test(rawText),
    hasLuckyDraw: /럭드|lucky\s*draw/i.test(rawText),
    hasPopup: /팝업|popup/i.test(rawText),
    hasOffline: /오프라인|offline|대면|fansign/i.test(rawText),
    hasOnline: /온라인|online|영상통화|영통/i.test(rawText)
  };
}
