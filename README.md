# MAKESTAR Asana Tool

MAKESTAR 이벤트 기획서(Word / PDF)를 파싱해 Asana 태스크를 일괄 생성하는 내부 운영 도구입니다.

## 주요 기능

- **기획서 파싱** — Word(.docx) / PDF 업로드 시 이벤트 정보·포토카드·MD 특전·VMD·오픈 태스크를 자동 추출
- **Asana 일괄 생성** — 파싱된 데이터를 바탕으로 프로젝트 내 태스크를 한 번에 생성
- **미리보기** — 생성 전 태스크 목록 확인 및 수정 가능
- **어드민 페이지** — 활동 로그 조회 및 설정 관리

## 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **API**: Asana REST API

## 로컬 실행

```bash
cd ProposalToAsanaV2
npm install
cp .env.example .env.local  # 환경 변수 설정
npm run dev
```

`.env.local` 에 Asana Personal Access Token 입력 후 사용 가능합니다.

## 배포

Vercel을 통해 `main` 브랜치 push 시 자동 배포됩니다.
