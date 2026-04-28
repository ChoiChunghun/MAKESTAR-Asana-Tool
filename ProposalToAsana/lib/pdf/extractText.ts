import pdf from "pdf-parse";
import { normalizePdfText } from "./normalizePdfText";

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // TODO: 스캔형 PDF 대응이 필요해지면 이 지점에서 OCR 엔진을 추가한다.
  const parsed = await pdf(buffer);
  return normalizePdfText(parsed.text || "");
}
