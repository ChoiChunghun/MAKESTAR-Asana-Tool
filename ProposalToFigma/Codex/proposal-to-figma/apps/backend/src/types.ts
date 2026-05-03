export const REVIEW_FLAGS = [
  "PRODUCT_CODE_NOT_FOUND",
  "EVENT_TITLE_NOT_FOUND",
  "ARTIST_ALBUM_INFERRED",
  "PERIOD_NOT_FOUND",
  "BENEFIT_NOT_FOUND",
  "BENEFIT_COUNT_EXCEEDED_STORY_LIMIT",
  "BENEFIT_COUNT_EXCEEDED_OPEN01_LIMIT",
  "CONDITION_GROUP_COUNT_EXCEEDED",
  "TEXT_MAY_OVERFLOW",
  "IMAGE_REQUIRED",
  "MANUAL_REVIEW_REQUIRED"
] as const;

export type ReviewFlag = (typeof REVIEW_FLAGS)[number];

export type ProposalLanguage = "KR" | "EN" | "SC" | "JA";

export type ProposalRange = "B:B";

export type OutputType =
  | "BANNER"
  | "STORY"
  | "SNS_X_OPEN_01"
  | "SNS_X_OPEN_02"
  | "SNS_X_OPEN_03"
  | "SNS_X_UPDATE";

export type BenefitType =
  | "Photocard"
  | "Photocards"
  | "Pic"
  | "Event"
  | "Printout"
  | "AutographSheet"
  | "Acrylic"
  | "Album"
  | "Etc";

export type BenefitValue = "Null" | "Sign" | "Msg" | "ToSign" | "ToMsg" | "Drawing" | "Luck";
export type BenefitEffect = "Null" | "Hologram" | "Lenticular" | "Clear";
export type BenefitCardType = "Vertical" | "Horizontal" | "Polar" | "Mini";

export type SheetReaderInput = {
  spreadsheetUrl: string;
  sheetName?: string;
  range?: ProposalRange;
};

export type SheetRow = {
  rowNumber: number;
  value: string;
  sourceRef: string;
};

export type BenefitItem = {
  benefitType: BenefitType;
  rawText: string;
  name: string;
  count: number;
  setName?: string;
  value?: BenefitValue;
  effect?: BenefitEffect;
  cardType?: BenefitCardType;
  sourceRef: string;
};

export type ConditionGroup = {
  title: string;
  conditionText: string;
  items: BenefitItem[];
  sourceRefs: string[];
};

export type ProposalSourceMap = {
  basicInfo: string[];
  schedule: string[];
  benefits: string[];
  conditions: string[];
  channels: string[];
  designHints: string[];
  [key: string]: string[];
};

export type ProposalData = {
  sourceSpreadsheetId: string;
  sourceSheetName: string;
  sourceRange: ProposalRange;
  rawRows: SheetRow[];
  rawText: string;
  productCode: string;
  eventTitle: string;
  artistName: string;
  albumName: string;
  eventType: {
    hasVideoCall: boolean;
    hasFansign: boolean;
    hasShowcase: boolean;
    hasLuckyDraw: boolean;
    hasPopup: boolean;
    hasOffline: boolean;
    hasOnline: boolean;
  };
  schedule: {
    salesPeriod?: string;
    applyPeriod?: string;
    eventDate?: string;
    winnerDate?: string;
  };
  benefits: BenefitItem[];
  conditionGroups: ConditionGroup[];
  channels: {
    makestar: boolean;
    weidian: boolean;
    x: boolean;
    instagram: boolean;
  };
  designHints: {
    language: ProposalLanguage;
    mainBgImage?: string;
    bgColorHex?: string;
    conceptText?: string;
    hasEventHashtag?: boolean;
    hasSiteInfo?: boolean;
  };
  sourceMap: ProposalSourceMap;
  reviewFlags: ReviewFlag[];
};

export type DesignOutput = {
  outputId: string;
  outputType: OutputType;
  templateLabel: string;
  templateInstanceName: string;
  componentProps: Record<string, string | boolean>;
  textBindings: Record<string, string>;
  imageBindings: Record<string, string>;
  colorBindings: Record<string, string>;
  sourceRefs: string[];
  reviewFlags: ReviewFlag[];
};

export type DesignData = {
  designId: string;
  sourceSpreadsheetId: string;
  sourceSheetName: string;
  sourceRange: ProposalRange;
  sourceHash: string;
  proposal: ProposalData;
  outputs: DesignOutput[];
};

export type ParseSheetRequest = {
  spreadsheetUrl: string;
  sheetName?: string;
  range?: ProposalRange;
};

export type ParseSheetResponse = {
  proposalData: ProposalData;
  designData: DesignData;
};

export type DiffDesignRequest = {
  spreadsheetUrl: string;
  sheetName?: string;
  range?: ProposalRange;
  previousSourceHash: string;
  outputId: string;
};

export type DiffDesignResponse = {
  hasChanges: boolean;
  previousSourceHash: string;
  currentSourceHash: string;
  changedFields: string[];
  designData: DesignData;
  output: DesignOutput;
};

