export const DUE_DAYS_OFFSET = 7;
export const VMD_FIXED_ITEM_COUNT = 4;

export const CF_STATUS = "1207665965030077";
export const CF_STATUS_PROGRESS = "1207665965030078";
export const CF_TASK_TYPE = "1213891002087335";
export const CF_TASK_TYPE_MD = "1213891002087339";
export const CF_TASK_TYPE_PC = "1213891002087338";
export const CF_TASK_TYPE_UPDATE = "1213891002087337";
export const CF_TASK_TYPE_OPEN = "1212593461428977";
export const CF_TASK_TYPE_VMD = "1212593461428981";
export const CF_TASK_TYPE_ETC = "1212593461428982";
export const CF_EVENT_TYPE = "1212472934572818";

// 이벤트 구분 (multi-enum) 각 옵션 GID
export const CF_EVENT_OPT_TEUKJEON     = "1212472934572819"; // 특전 (온라인 럭키드로우 포함)
export const CF_EVENT_OPT_SHOWCASE     = "1212472934572820"; // 쇼케이스 초대
export const CF_EVENT_OPT_TWOSHOT      = "";                 // 투샷회 (Asana 옵션 없음)
export const CF_EVENT_OPT_YT1          = "1212472934572821"; // 영통 1
export const CF_EVENT_OPT_YT2          = "1212656971408705"; // 영통 2
export const CF_EVENT_OPT_DAEMYEON     = "1212472934572823"; // 대면
export const CF_EVENT_OPT_PHOTO        = "1212507993874941"; // 포토
export const CF_EVENT_OPT_OFFLINE_EV   = "1212472934572824"; // 오프라인 이벤트
export const CF_EVENT_OPT_OFFLINE_LD   = "1212472934572825"; // 오프라인 럭키드로우
export const CF_EVENT_OPT_FUNDING      = "1212472934572826"; // 펀딩
export const CF_EVENT_OPT_GENERAL      = "1212472934572827"; // 일반 판매
export const CF_EVENT_OPT_DERIVED      = "1212593460253872"; // 파생
export const CF_EVENT_OPT_ETC          = "1212472934572828"; // 기타

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
  "사진",
  "컷",
  "볼펜",
  "티켓",
  "L홀더",
  "스티커",
  "코스터",
  "엽서",
  "핀버튼",
  "파우치",
  "피크",
  "골트래커",
  "골 트래커",
  "키캡",
  "명찰",
  "스마트톡",
  "띠부씰",
  "손거울",
  "메모지",
  "쿠폰",
  "우표",
  "뱃지",
  "카드",
  "탑로더",
  "인화 2컷",
  "인화 4컷",
  "증명사진",
  "메시지 카드",
  "시험지"
];

export const EXCLUDE_PATTERNS_BENEFIT = [
  /한\s*주문\s*건에서.*구매\s*시/i,
  /중복\s*없이.*세트\s*증정/i,
  /추가\s*증정/i
];

// 포토카드 라인 단위 제외 패턴 (구매 조건문, 다량 구매 증정 등)
export const EXCLUDE_PATTERNS_PC = [
  /한\s*주문\s*건에서.*구매\s*시/i,  // "한 주문 건에서 N매 구매 시 ~"
  /이상\s*구매\s*시/i,               // "N매 이상 구매 시 ~"
  /추가\s*증정/i,                    // "추가 증정 포토카드"
  /중복\s*없이/i,                    // "중복없이 세트 제공"
  /동일\s*이미지/i,                  // "와 동일 이미지" - 다른 항목 참조 설명문
  /배송\s*예정/i                     // "추후 배송 예정" - 배포 안내문
];

// 포토카드 이름 앞 수식어 제거 패턴
export const PC_NAME_PREFIX_STRIP = [
  /^응모한\s*멤버의?\s*/i,           // "응모한 멤버의 사인 포토카드" → "사인"
  /^당첨자\s*한정\s*(미공개\s*)?/i,  // "당첨자 한정 미공개 셀카" → "셀카"
  /^한정\s*(미공개\s*)?/i,           // "한정 미공개 ~" → 이하 내용
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
  "행운",
  "친필"
];

export const VMD_OFFLINE_LABELS = [
  "쇼케이스 초대",
  "대면",
  "포토",
  "오프라인 이벤트",
  "오프라인 럭키드로우"
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

export const NO_WINNER_TASK_LABELS = ["특전", "펀딩", "일반 판매", "파생"];

export const SNS_DATE_NOTICE_LABELS = [
  "대면",
  "쇼케이스 초대",
  "투샷회",
  "영통 1",
  "영통 2",
  "포토",
  "오프라인 이벤트",
  "오프라인 럭키드로우"
];
