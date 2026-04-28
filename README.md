# Genspark 보정 프롬프트 자동 추출

원본/보정본 이미지 쌍을 `https://www.genspark.ai/ai_image`에 올리고,  
Auto Prompt 기반으로 도출된 프롬프트를 수집해 `CSV/TXT`로 저장합니다.

## 1) 준비

```bash
npm install
npx playwright install chromium
```

## 2) 이미지 쌍 목록 작성

`/pairs/pairs.csv`를 아래 형식으로 작성:

```csv
id,category,original_path,edited_path
portrait-001,portrait,./pairs/portrait/original_001.jpg,./pairs/portrait/edited_001.jpg
food-003,food,./pairs/food/original_003.jpg,./pairs/food/edited_003.jpg
```

- `id`: 결과 식별자
- `category`: 유형 분류(선택이지만 권장)
- `original_path`, `edited_path`: 절대경로 또는 현재 폴더 기준 상대경로

## 3) 로그인 세션 저장 (최초 1회)

```bash
npm run setup
```

- 브라우저가 뜨면 Genspark 로그인 완료
- `ai_image` 화면이 열린 상태에서 터미널 엔터
- 세션 파일이 `data/genspark-auth.json`으로 저장됨

## 4) 일괄 실행

```bash
npm run run
```

실행 결과:

- `outputs/prompts.csv`: 구조화 결과
- `outputs/prompts.txt`: 텍스트 모음
- `outputs/errors.log`: 실패 목록
- `outputs/*_error.png`: 실패 시 스크린샷

## 커스텀 옵션

```bash
node scripts/extract-genspark-prompts.js --manifest=./pairs/pairs.csv --slowmo=80 --timeout-ms=120000
```

## 참고

- Genspark UI가 바뀌면 버튼/입력 셀렉터가 달라져 추출 실패가 날 수 있습니다. 이 경우 `outputs/*_error.png`를 보고 스크립트의 셀렉터 후보를 수정하세요.
- 추출 질문은 스크립트 상수로 고정되어 있습니다:
  - `처음 올린 원본을 이후 올린 보정본 처럼 만들려면 어떤 프롬프트가 필요한가?`
