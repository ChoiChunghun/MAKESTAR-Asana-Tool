export type ParsedItem = {
  name: string;
  count: number;
  hasHandwriting?: boolean;
};

export type DocumentType = "pdf" | "docx" | "googledoc";

export type NormalizedPlanData = {
  fullText: string;
  lines: string[];
  benefitLines: string[];
  benefitText: string;
  specialIdx: number;
  eventTitle: string;
  artistName: string;
  albumName: string;
  agency: string;
  venue: string;
  eventSourceText: string;
  sourceFileName?: string;
  documentType?: DocumentType;
  winnerAnnouncementIso?: string | null;
  applicationStartIso?: string | null;   // 응모 시작 일시 (YYYY-MM-DD)
  applicationEndIso?: string | null;     // 응모 종료 일시 (YYYY-MM-DD)
};

export type OpenEventLabel =
  | "특전"
  | "쇼케이스 초대"
  | "투샷회"
  | "영통 1"
  | "영통 2"
  | "대면"
  | "포토"
  | "오프라인 이벤트"
  | "오프라인 럭키드로우"
  | "펀딩"
  | "일반 판매"
  | "파생"
  | "기타";

export type OpenContext = {
  planningUrl: string;
  planningLabel: string;
  storyCount: number;
  vmdItemCount: number;
  venue: string;
  compositeImageNeeded: string;
  eventLabels: OpenEventLabel[];
  includePackshot: boolean;
  snsItems: string[];
  eventSourceText: string;
  hasPromoEvent: boolean;
  /** 웨이디엔(YDN) 플랫폼 오픈 여부 — true이면 시트 언어 검수 없이 YDN 어드민 등록·검수 생성 */
  isYdn: boolean;
};

export type DueFields = {
  due_on?: string;
  due_at?: string;
};

export type TaskKey =
  | "winner"
  | "vmd"
  | "vmdsub"
  | "md"
  | "pc"
  | "sp"
  | "up"
  | "upsub"
  | "open"
  | "opendesign"
  /** 시트 언어 검수 (메이크스타 오픈 전용, SNS·YDN 제외) */
  | "sitelang"
  /** 어드민 상품 등록 (메이크스타) 또는 YDN 어드민 등록·검수 */
  | "adminreg";

export type PreviewTaskRow = {
  key: TaskKey;
  label: string;
  title: string;
  enabled: boolean;
  available: boolean;
  indent: number;
  isParent: boolean;
  parentKey?: TaskKey;
  unavailableReason?: string;
};

export type DueSummary = {
  deadlineIso: string | null;
  winnerAnnouncementIso: string | null;
  open: DueFields;
  md: DueFields;
  update: DueFields;
  vmd: DueFields;
  winner: DueFields;
  text: string;
};

export type ParsedPlanSummary = {
  productCode: string;
  productCodeDetected: boolean;
  eventTitle: string;
  artistName: string;
  albumName: string;
  eventLabels: OpenEventLabel[];
  deadlineIso: string | null;
  winnerAnnouncementIso: string | null;
  sectionName: string;
  photocards: ParsedItem[];
  benefits: ParsedItem[];
  photocardTotal: number;
  benefitTotal: number;
  storyCount: number;
  snsItems: string[];
  createVmdTask: boolean;
  createWinnerAnnouncementTask: boolean;
  dueSummary: DueSummary;
  venue: string;
  applicationStartIso: string | null;
};

export type ParsedPlanResult = {
  normalizedData: NormalizedPlanData;
  summary: ParsedPlanSummary;
  openContext: OpenContext;
  previewRows: PreviewTaskRow[];
};
