import { normalizeDocumentText } from "./normalizeText";

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const pdf = (await import("pdf-parse")).default;
    const parsed = await pdf(buffer);
    return normalizeDocumentText(parsed.text || "");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Invalid PDF") || msg.includes("PDF structure")) {
      throw new Error("올바른 PDF 파일이 아닙니다. 파일이 손상되었거나 잘못된 형식일 수 있습니다.");
    }
    throw new Error("PDF 파일을 읽는 중 오류가 발생했습니다. 파일을 다시 확인해주세요.");
  }
}
