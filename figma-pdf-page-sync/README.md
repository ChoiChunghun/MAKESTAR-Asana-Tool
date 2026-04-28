# PDF Page Sync

안정성 우선으로 다시 만든 Figma 플러그인입니다. 첫 실행에서는 UI 표시와 selection count만 확인하며, 네트워크 요청이나 이미지 변경은 사용자가 버튼을 누르기 전까지 실행하지 않습니다.

## 폴더 구조

```text
figma-pdf-page-sync/
  manifest.json
  src/
    code.ts
    ui.html
    ui.ts
    shared/
      types.ts
      logger.ts
      selection.ts
      pluginData.ts
      imageFill.ts
      manifestClient.ts
  dist/
  sample-assets/
    test-doc/
      manifest.json
      page-0001.png
    test-image.png
  package.json
  README.md
  COMMON_PITFALLS.md
```

## 테스트 절차

1. 의존성 설치

```bash
npm install
```

2. 빌드, 샘플 asset 생성, localhost 서버 실행

```bash
npm run watch
```

서버는 `http://localhost:9910`만 사용합니다.

3. Figma Desktop에서 `Plugins > Development > Import plugin from manifest...`를 열고 `manifest.json`을 선택합니다.

반드시 프로젝트 루트의 아래 파일을 선택해야 합니다.

```text
figma-pdf-page-sync/manifest.json
```

아래 파일은 Figma에 import하는 플러그인 manifest가 아닙니다. `Real Sync` 버튼을 눌렀을 때 플러그인이 URL로 읽는 PDF source manifest입니다.

```text
figma-pdf-page-sync/sample-assets/test-doc/manifest.json
```

4. 플러그인을 실행합니다.

5. UI가 표시되는지 확인합니다.

상단에 아래 값이 보여야 합니다.

- `plugin boot status`
- `current selection count`
- `selection read`
- `current sourcePdfId`

6. Rectangle 2개를 선택합니다.

7. `sourcePdfId=test-doc`, `pageNumber=1` 입력 후 `Connect`를 누릅니다.

8. `Read current mapping`으로 pluginData 저장 상태를 확인합니다.

저장되는 JSON 필드는 아래 3개입니다.

```json
{
  "sourcePdfId": "test-doc",
  "pageNumber": 1,
  "syncEnabled": true
}
```

9. `Test Sync with sample image`를 실행합니다.

이 버튼을 누른 시점에만 `http://localhost:9910/sample-assets/test-image.png`를 사용해 image fill을 교체합니다.

10. 선택한 Rectangle/Frame에 이미지 fill이 반영되는지 확인합니다.

11. `Manifest URL or base URL`에 기본값 `http://localhost:9910/sample-assets`를 둔 상태로 `Real Sync`를 실행합니다.

실제 호출 URL은 mapping의 `sourcePdfId`를 사용해 아래처럼 만들어집니다.

```text
http://localhost:9910/sample-assets/test-doc/manifest.json
```

manifest에서 page `1`의 이미지 URL을 읽어 선택 노드에 반영합니다.

## 단계별 구현 상태

- Phase 1: 부팅 성공, UI 표시, selection count 표시
- Phase 2: Rectangle/Frame 대상 pluginData 저장
- Phase 3: 고정 샘플 이미지 URL로 수동 Test Sync
- Phase 4: 사용자가 누른 경우에만 manifest fetch 후 Real Sync

## 안전장치

- 실행 직후 자동 fetch 없음
- 실행 직후 자동 sync 없음
- Auto Sync 없음
- 플러그인 내부 PDF 파싱 없음
- 모든 버튼 핸들러 try/catch 적용
- fetch timeout, HTTP error, JSON parse error 처리
- pluginData JSON.parse 보호
- 미지원 노드 타입은 skip 후 UI와 console에 표시

## manifest 설정

`manifest.json`은 안정성 검증을 위해 `allowedDomains`를 `["none"]`으로 시작합니다. 개발 플러그인에서 localhost만 허용합니다.

```json
"networkAccess": {
  "allowedDomains": ["none"],
  "devAllowedDomains": ["http://localhost:9910"]
}
```

`127.0.0.1`은 사용하지 않습니다.

## 샘플 manifest

```json
{
  "schemaVersion": 1,
  "sourcePdfId": "test-doc",
  "version": "sample-v1",
  "pageCount": 1,
  "pages": {
    "1": "http://localhost:9910/sample-assets/test-doc/page-0001.png"
  }
}
```

## 디버깅 로그

Figma console과 UI log 영역에 아래 흐름이 표시됩니다.

- `[boot] plugin start`
- `[boot] showUI called`
- `[selection] selected count: X`
- `[connect] mapping saved`
- `[sync:test] start`
- `[sync:test] success`
- `[sync:real] fetching manifest`
- `[sync:real] manifest loaded`
- `[sync:real] page url resolved`
- `[sync:real] image fill applied`
- `[error] ...`
