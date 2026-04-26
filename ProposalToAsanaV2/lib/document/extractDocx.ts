import { normalizeDocumentText } from "./normalizeText";

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return normalizeDocumentText(result.value || "");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    // mammoth 내부 오류를 사용자 친화적 메시지로 변환
    if (msg.includes("end of central directory") || msg.includes("zip")) {
      throw new Error("올바른 Word(.docx) 파일이 아닙니다. 파일이 손상되었거나 잘못된 형식일 수 있습니다.");
    }
    throw new Error("Word 파일을 읽는 중 오류가 발생했습니다. 파일을 다시 확인해주세요.");
  }
}
