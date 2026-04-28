# PDF 기획서 Asana 태스크 생성 웹사이트

PDF 기획서를 업로드하면 서버에서 텍스트를 추출하고, 기존 Google Sheet + Apps Script 자동화 기준으로 파싱한 뒤, 사용자가 태스크 초안을 검토/수정하고 Asana에 생성하는 내부 운영용 Next.js 웹사이트입니다.

## 현재 범위

- 텍스트형 PDF 기준으로 동작합니다.
- 스캔형 PDF는 텍스트 추출 정확도가 낮을 수 있습니다.
- 업로드 PDF는 장기 저장하지 않습니다.
- DB, 로그인, 업로드 이력, 여러 PDF 일괄 처리는 초기 버전에서 제외했습니다.
- OCR 확장 포인트는 `lib/pdf/extractText.ts`에 TODO로 남겨두었습니다.

## 로컬 실행

```bash
cd "ProposalToAsana"
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## Asana 환경변수

`.env.local`에 아래 값을 설정합니다.

```bash
ASANA_TOKEN=your_asana_personal_access_token
ASANA_DEFAULT_PROJECT_GID=1213881735025332
ASANA_ASSIGNEE_GID=1144816139914898
```

- `ASANA_TOKEN`: 서버에서만 사용합니다. 클라이언트로 내려가지 않습니다.
- `ASANA_DEFAULT_PROJECT_GID`: 기존 Apps Script의 `TESTFARM_GID` 기본값입니다.
- `ASANA_ASSIGNEE_GID`: 기존 Apps Script의 `ASSIGNEE_GID` 기본값입니다.

## 주요 플로우

1. 사용자가 PDF 기획서를 업로드합니다.
2. `/api/parse-pdf`가 PDF 텍스트를 추출합니다.
3. `buildPdfData`가 `NormalizedPlanData` 중간 구조를 만듭니다.
4. parser 순수 함수들이 상품코드, 포토카드, 특전, 이벤트 구분, 마감일을 파싱합니다.
5. 화면에 요약과 생성 예정 태스크 표를 표시합니다.
6. 상품코드가 없으면 `상품코드_확인필요` 임시값으로 초안을 만들고, 화면에서 실제 상품코드를 입력해 섹션명/태스크명에 일괄 반영할 수 있습니다.
7. 사용자가 생성 여부, 태스크명, 프로젝트, 섹션명을 수정합니다.
8. `/api/asana/create-tasks`가 서버에서만 Asana API를 호출합니다.
9. 성공 시 Asana 프로젝트 링크를 안내합니다.

## 파싱 로직 요약

- 상품코드: `상품코드` 라벨 근처 값을 우선 찾고, 없으면 `/P_\d+[A-Z0-9_]*/i` 패턴을 전체 텍스트에서 찾습니다. 그래도 없으면 `상품코드_확인필요` 임시값으로 미리보기를 계속 진행합니다.
- 특전 anchor: `메이크스타 특전` 이후 라인을 `benefitLines`로 분리합니다. `유의사항`은 특전/스토리 세부 파싱 종료점으로 사용합니다.
- 포토카드: `benefitLines`에서 `포토카드` 포함 라인만 후보로 보고, 참석권/관람권/앨범/이벤트/키링/폴라로이드/포스트잇 포함 라인은 제외합니다. 수량은 `(\d+)\s*(매|종)`을 사용합니다.
- 특전: `BENEFIT_KEYWORDS`가 포함된 항목 중 `포토카드`를 제외하고, 수량은 `(\d+)\s*(매|종|개)`을 사용합니다. 같은 이름은 count를 합산합니다.
- 손글씨/손그림 여부: `HANDWRITING_KEYWORDS` 포함 여부로 설명 HTML에 O/X를 표시합니다.
- 이벤트 구분: 기존 `detectOpenEvents_` 기준의 키워드와 정렬 순서를 유지합니다.
- 스토리 수: `For. ...`, `SPECIAL GIFT`, `SPECIAL EVENT`, `SPECIAL GIFT 1`, `SPECIAL EVENT 2` 형태를 라인 단위로 카운트합니다.
- SNS 항목: 기본 `메인`, 홍보 이벤트/대면/쇼케이스/이벤트 라벨 수에 따라 기존 기준으로 추가합니다.
- VMD: 쇼케이스 초대, 대면, 포토, 오프라인 이벤트, 오프라인 럭키드로우 중 하나라도 있으면 생성합니다.
- 당첨자 선정: 이벤트 라벨이 오직 `특전` 하나일 때만 생성하지 않습니다.
- 섹션명: `MM/DD 상품코드` 형식입니다. 시작일을 못 찾으면 오늘 날짜를 사용합니다.
- due 규칙: 오픈은 마감일 13:00 KST `due_at`, 업데이트는 마감일 -1일 `due_on`, MD/VMD는 마감일 `due_on`, 당첨자 선정은 오늘 + `DUE_DAYS_OFFSET`입니다.

## Apps Script 함수 매핑

| 기존 Apps Script 함수/개념 | TypeScript 위치 |
| --- | --- |
| `ASANA_TOKEN` | `.env.local`의 `ASANA_TOKEN`, `lib/asana/client.ts` |
| `TESTFARM_GID`, `ASSIGNEE_GID`, `DUE_DAYS_OFFSET`, `VMD_FIXED_ITEM_COUNT` | `lib/parser/constants.ts`, 서버 env override는 `lib/asana/client.ts` |
| 커스텀필드 상수/태스크 타입명/키워드 | `lib/parser/constants.ts` |
| `buildSheetData_` | `lib/pdf/buildPdfData.ts`의 `buildPdfData` |
| `getProductCode_` | `lib/parser/parseProductCode.ts`의 `parseProductCode` |
| `parsePhotocards_` | `lib/parser/parsePhotocards.ts`의 `parsePhotocards` |
| `parseBenefits_`, `extractBenefitItem_`, `shouldExcludeBenefitCell_` | `lib/parser/parseBenefits.ts` |
| `buildOpenContext_` | `lib/parser/parseOpenContext.ts`의 `buildOpenContext` |
| `detectOpenEvents_`, `sortOpenEventLabels_` | `lib/parser/parseOpenContext.ts` |
| `countOpenStoryItems_`, `isOpenStoryLine_` | `lib/parser/parseOpenContext.ts` |
| `buildOpenSnsItems_` | `lib/parser/parseOpenContext.ts` |
| `shouldCreateVmdTask_` | `lib/parser/parseOpenContext.ts` |
| `shouldCreateWinnerAnnouncementTask_` | `lib/parser/parseOpenContext.ts` |
| `buildSectionName_`, `parseEventStartDate_` | `lib/parser/parseDeadline.ts` |
| `parseApplicationDeadlineIsoDate_`, due helper 계열 | `lib/parser/parseDeadline.ts` |
| `buildPhotocardDescription_` | `lib/parser/descriptions.ts` |
| `buildBenefitDescription_` | `lib/parser/descriptions.ts` |
| `buildUpdateDescription_` | `lib/parser/descriptions.ts` |
| `buildOpenDescription_` | `lib/parser/descriptions.ts` |
| `buildVmdDescription_` | `lib/parser/descriptions.ts` |
| `getAvailableProjectOptions_`, `getProjectInfo_` | `lib/asana/projects.ts` |
| `getOrCreateSection_`, `moveSectionToTop_`, `addTaskToSection_` | `lib/asana/sections.ts` |
| 커스텀필드 탐색/옵션 탐색/필수 필드 오류 | `lib/asana/customFields.ts` |
| `setEventFieldOnTask_` | `lib/asana/customFields.ts` |
| `createMdTasks_`, `createOpenTasks_`, `createVmdTask_`, `createUpdateTasks_`, `createWinnerAnnouncementTask_` | `lib/asana/tasks.ts` |

## 테스트

샘플 mock PDF text는 `tests/fixtures/sample-plan-text.txt`에 있습니다.

```bash
npm run test
npm run typecheck
```

## API

- `POST /api/parse-pdf`: `multipart/form-data`의 `file` PDF를 받아 파싱 결과와 미리보기 rows를 반환합니다.
- `GET /api/asana/projects`: 기본 프로젝트의 workspace 기준으로 프로젝트 목록을 가져옵니다.
- `POST /api/asana/create-tasks`: 사용자가 수정한 rows, 프로젝트, 섹션명, 파싱 결과를 받아 Asana 태스크를 생성합니다.

## Asana 에러 처리

Asana API 오류는 사용자가 이해하기 쉬운 한국어로 변환합니다.

- 인증 실패: 토큰 확인 안내
- 권한 부족: 프로젝트/태스크 생성 권한 확인 안내
- 리소스 없음: 프로젝트/섹션/필드 확인 안내
- 요청 한도 초과: 잠시 후 재시도 안내
- 필수 커스텀필드/옵션 없음: 프로젝트명, 필드명, 옵션명을 포함한 명확한 메시지
