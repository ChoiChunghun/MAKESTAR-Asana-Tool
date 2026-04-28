import { normalizeDocumentText } from "./normalizeText";

function parseGoogleDocId(input: string): string | null {
  const trimmed = input.trim();

  // Pattern 1: 전체 URL에서 추출 — docs.google.com 도메인 필수
  const urlMatch = trimmed.match(/https?:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]{20,80})/);
  if (urlMatch?.[1]) return urlMatch[1];

  // Pattern 2: 순수 문서 ID (영숫자/-/_ 만, 25~80자) — 잘못된 ID는 Google이 404 반환
  if (/^[a-zA-Z0-9_-]{25,80}$/.test(trimmed)) return trimmed;

  return null;
}

export async function extractTextFromGoogleDoc(urlOrId: string): Promise<string> {
  const docId = parseGoogleDocId(urlOrId);
  if (!docId) throw new Error("Google Doc URL 또는 문서 ID를 올바르게 입력해주세요.");

  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const response = await fetch(exportUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
    redirect: "follow",
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "Google Doc 접근 권한이 없습니다.\n\n" +
      "해결 방법: 문서 우측 상단 '공유' → '링크가 있는 모든 사용자' → '뷰어'로 설정 후 다시 시도해주세요."
    );
  }
  if (response.status === 404) {
    throw new Error("Google Doc을 찾을 수 없습니다. URL이 올바른지 확인해주세요.");
  }
  if (!response.ok) {
    throw new Error(`Google Doc을 가져오지 못했습니다. (HTTP ${response.status})`);
  }

  const text = await response.text();

  // Google이 로그인 페이지 HTML을 200으로 반환하는 경우 감지
  if (text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) {
    throw new Error(
      "Google Doc에 접근하려면 로그인이 필요합니다.\n\n" +
      "해결 방법: 문서 우측 상단 '공유' → '링크가 있는 모든 사용자' → '뷰어'로 설정 후 다시 시도해주세요."
    );
  }

  return normalizeDocumentText(text);
}
