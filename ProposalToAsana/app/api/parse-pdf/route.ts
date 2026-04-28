import { NextResponse } from "next/server";
import { buildPdfData } from "@/lib/pdf/buildPdfData";
import { extractTextFromPdf } from "@/lib/pdf/extractText";
import { buildPreviewData } from "@/lib/parser/buildPreviewData";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "PDF 파일을 업로드해주세요." }, { status: 400 });
    }

    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json({ message: "PDF 파일만 업로드할 수 있습니다." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const text = await extractTextFromPdf(buffer);

    if (!text.trim()) {
      return NextResponse.json(
        {
          message:
            "PDF에서 텍스트를 추출하지 못했습니다. 현재 버전은 텍스트형 PDF 기준이며, 스캔형 PDF는 OCR 확장 후 정확도가 좋아집니다."
        },
        { status: 422 }
      );
    }

    const normalizedData = buildPdfData(text, file.name);
    const preview = buildPreviewData(normalizedData);

    return NextResponse.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF를 파싱하는 중 알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
