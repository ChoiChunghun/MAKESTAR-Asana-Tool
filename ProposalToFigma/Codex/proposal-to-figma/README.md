# Proposal-to-Figma Design Generator

Google Spreadsheet 또는 Word 기획서를 읽고, MAKESTAR Event Design System Figma 템플릿을 기반으로 디자인 산출물을 자동 생성하는 MVP 프로젝트입니다. 이번 버전은 Google Sheet 기획서의 `B:B` 범위와 Figma 내 `Banner`, `Story`, `SNS X OPEN 01` 생성에 집중합니다.

## 1. 설치 방법

```bash
cd /Users/CCH/Documents/2026\ 뉴임펙트\ 팀\ 과제/00_Automation/ProposalToFigma/Codex/proposal-to-figma
npm install
```

Google Sheet가 공개 문서가 아니라면 아래 둘 중 하나를 준비해야 합니다.

- `GOOGLE_API_KEY`
- `GOOGLE_SERVICE_ACCOUNT_JSON` 또는 `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`

## 2. Backend 실행 방법

```bash
cd /Users/CCH/Documents/2026\ 뉴임펙트\ 팀\ 과제/00_Automation/ProposalToFigma/Codex/proposal-to-figma
npm run dev:backend
```

기본 포트는 `8787`입니다. `POST /api/parse-sheet`, `POST /api/designs/diff`, `GET /health`를 제공합니다.

## 3. Figma Plugin 빌드 방법

```bash
cd /Users/CCH/Documents/2026\ 뉴임펙트\ 팀\ 과제/00_Automation/ProposalToFigma/Codex/proposal-to-figma
npm run build:plugin
```

빌드 결과는 아래에 생성됩니다.

- `apps/figma-plugin/dist/ui.html`
- `apps/figma-plugin/dist/code.js`

## 4. Figma에서 Plugin 불러오는 방법

1. Figma Desktop에서 `Plugins > Development > Import plugin from manifest...`를 엽니다.
2. `apps/figma-plugin/manifest.json`을 선택합니다.
3. Plugin 실행 전에 backend가 `http://127.0.0.1:8787` 또는 `http://localhost:8787`에서 떠 있는지 확인합니다.

## 5. Google Sheet URL 입력 방법

Plugin UI의 `Source` 섹션에서 아래를 입력합니다.

- `Backend URL`: 기본값 `http://127.0.0.1:8787`
- `Google Sheet URL`: 공유된 스프레드시트 URL
- `Sheet tab`: 비워두면 첫 번째 visible sheet 사용
- `Range`: MVP 기본값 `B:B`

`Connect` 또는 `Parse`를 누르면 backend가 B열을 읽고 `ProposalData`, `DesignData`를 반환합니다.

## 6. Banner / Story / SNS X OPEN 01 생성 방법

1. `Parse` 완료 후 `Output Preview`에서 생성할 output을 선택합니다.
2. `Generate Selected` 또는 `Generate All`을 누릅니다.
3. Plugin은 Figma 파일에서 이름 기반으로 템플릿 인스턴스를 찾고 clone합니다.
4. clone한 인스턴스에 실제 `componentProperties` key를 읽어 `setProperties`를 적용합니다.
5. 텍스트 노드가 `{{artistAlbumTitle}}` 같은 이름을 가지면 우선 사용하고, 없으면 placeholder 문자 fallback으로 치환합니다.

생성된 인스턴스 이름은 아래 형식입니다.

- `[AUTO] {productCode} / BANNER`
- `[AUTO] {productCode} / STORY`
- `[AUTO] {productCode} / SNS_X_OPEN_01`

## 7. Check Updates / Apply Updates 사용 방법

1. Plugin으로 생성한 `[AUTO] ...` 인스턴스를 선택합니다.
2. `Check Updates`를 누르면 선택 노드의 `proposalToFigmaBinding`을 읽어 원본 sheet를 다시 파싱합니다.
3. backend는 `sourceHash`와 output별 변경 필드를 계산해 돌려줍니다.
4. `Apply Updates`를 누르면 현재 선택된 인스턴스의 `componentProps`, `textBindings`, `lastSyncedAt`이 갱신됩니다.

현재 MVP는 최상위 `InstanceNode` 업데이트에 최적화되어 있습니다.

## 8. Figma 템플릿 레이어/컴포넌트 관리 규칙

- 원본 템플릿 인스턴스는 절대 직접 수정하지 않습니다. 항상 clone만 수정합니다.
- `instance.setProperties({ Benefit: "2" })`처럼 visible name만 바로 쓰지 않습니다. 반드시 실제 `componentProperties` key를 읽습니다.
- TextNode 수정 전에는 반드시 `figma.loadFontAsync`를 호출합니다.
- Google Sheet B열 원문 전체는 `pluginData`에 저장하지 않습니다.
- `proposalToFigmaBinding`에는 `sourceHash`, `outputId`, `sourceRefs`, `textBindings`, `componentProps`만 저장합니다.
- 템플릿 옵션으로 처리되지 않는 항목은 `reviewFlags`로 노출하고 디자이너가 수동 보정합니다.
- 자동 동기화는 하지 않습니다. 사용자가 `Check Updates`를 눌렀을 때만 재파싱합니다.

## 참고 경로

- 샘플 B열 fixture: [sample-b-column.txt](/Users/CCH/Documents/2026%20%E1%84%82%E1%85%B2%E1%84%8B%E1%85%B5%E1%86%B7%E1%84%91%E1%85%A6%E1%86%A8%E1%84%90%E1%85%B3%20%E1%84%90%E1%85%B5%E1%86%B7%20%E1%84%80%E1%85%AA%E1%84%8C%E1%85%A6/00_Automation/ProposalToFigma/Codex/proposal-to-figma/fixtures/sample-b-column.txt)
- Plugin manifest: [manifest.json](/Users/CCH/Documents/2026%20%E1%84%82%E1%85%B2%E1%84%8B%E1%85%B5%E1%86%B7%E1%84%91%E1%85%A6%E1%86%A8%E1%84%90%E1%85%B3%20%E1%84%90%E1%85%B5%E1%86%B7%20%E1%84%80%E1%85%AA%E1%84%8C%E1%85%A6/00_Automation/ProposalToFigma/Codex/proposal-to-figma/apps/figma-plugin/manifest.json)
