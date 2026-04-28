export const TESTFARM_GID = "1213881735025332";
export const ASSIGNEE_GID = "1144816139914898";
export const DUE_DAYS_OFFSET = 7;
export const VMD_FIXED_ITEM_COUNT = 4;

export const CF_STATUS = "1207665965030077";
export const CF_STATUS_PROGRESS = "1207665965030078";
export const CF_TASK_TYPE = "1213891002087335";
export const CF_TASK_TYPE_MD = "1213891002087339";
export const CF_TASK_TYPE_PC = "1213891002087338";
export const CF_TASK_TYPE_UPDATE = "1213891002087337";
export const CF_EVENT_TYPE = "";

export const CF_STATUS_NAME = "상태";
export const CF_STATUS_PROGRESS_NAME = "진행";
export const CF_TASK_TYPE_NAME = "태스크 구분";
export const CF_EVENT_TYPE_NAME = "이벤트 구분";

export const TASK_TYPE_NAME_MD = "MD";
export const TASK_TYPE_NAME_PC = "포토카드";
export const TASK_TYPE_NAME_UPDATE = "업데이트";
export const TASK_TYPE_NAME_OPEN = "오픈";
export const TASK_TYPE_NAME_VMD = "VMD";
export const TASK_TYPE_NAME_ETC = "기타";

export const EXCLUDE_KEYWORDS_PC = [
  "참석권",
  "관람권",
  "앨범",
  "이벤트",
  "키링",
  "폴라로이드",
  "포스트잇"
];

export const BENEFIT_KEYWORDS = [
  "키링",
  "뱃지",
  "카드",
  "엽서",
  "L홀더",
  "우표",
  "인화 2컷",
  "인화 4컷",
  "증명사진",
  "탑로더",
  "볼펜",
  "골 트래커",
  "골트래커",
  "메시지 카드",
  "스티커",
  "메모지",
  "시험지"
];

export const EXCLUDE_PATTERNS_BENEFIT = [
  /한\s*주문\s*건에서.*구매\s*시/i,
  /중복\s*없이.*세트\s*증정/i,
  /추가\s*증정/i
];

export const HANDWRITING_KEYWORDS = [
  "부적",
  "상장",
  "탐정",
  "메시지",
  "생일",
  "프리쿠라",
  "메세지",
  "낙서",
  "행운"
];

export const OPEN_EVENT_LABEL_ORDER = [
  "특전",
  "쇼케이스 초대",
  "투샷회",
  "영통 1",
  "영통 2",
  "대면",
  "포토",
  "오프라인 이벤트",
  "오프라인 럭키드로우",
  "펀딩",
  "일반 판매",
  "파생",
  "기타"
] as const;
