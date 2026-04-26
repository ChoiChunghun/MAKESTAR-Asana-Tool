import { NextResponse } from "next/server";
import { extractTextFromPdf } from "@/lib/document/extractPdf";
import { extractTextFromDocx } from "@/lib/document/extractDocx";
import { extractTextFromGoogleDoc } from "@/lib/document/extractGoogleDoc";
import { buildNormalizedData } from "@/lib/parser/parseOverview";
import { buildPreviewData } from "@/lib/parser/buildPreviewData";

export const runtime = "nodejs";

// 파서를 안전하게 실행 — 내부 예외가 전체 요청을 망가뜨리지 않도록 격리
function safeParseDocument(text: string, sourceName: string) {
  try {
    const normalizedData = buildNormalizedData(text, sourceName);
    const preview = buildPreviewData(normalizedData);
    return { ok: true as const, preview };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "문서 파싱 중 알 수 없는 오류가 발생했습니다.";
    console.error("[parse-document] parser threw:", err);
    return { ok: false as const, message };
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as { googleDocUrl?: string };
      if (!body.googleDocUrl) {
        return NextResponse.json({ message: "Google Doc URL을 입력해주세요." }, { status: 400 });
      }
      const text = await extractTextFromGoogleDoc(body.googleDocUrl);
      if (!text.trim()) {
        return NextResponse.json(
          { message: "Google Doc에서 텍스트를 추출하지 못했습니다." },
          { status: 422 }
        );
      }
      const result = safeParseDocument(text, "Google Doc");
      if (!result.ok) return NextResponse.json({ message: result.message }, { status: 500 });
      return NextResponse.json(result.preview);
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "파일을 업로드해주세요." }, { status: 400 });
    }

    // 파일 크기 제한: 30MB
    if (file.size > 30 * 1024 * 1024) {
      return NextResponse.json(
        { message: "파일 크기가 너무 큽니다. 30MB 이하 파일만 처리할 수 있습니다." },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let text = "";

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith(".pdf") || file.type === "application/pdf") {
      text = await extractTextFromPdf(buffer);
    } else if (
      fileName.endsWith(".docx") ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      text = await extractTextFromDocx(buffer);
    } else {
      return NextResponse.json(
        { message: "PDF 또는 Word (.docx) 파일만 업로드할 수 있습니다." },
        { status: 400 }
      );
    }

    if (!text.trim()) {
      return NextResponse.json(
        { message: "문서에서 텍스트를 추출하지 못했습니다. 텍스트형 파일인지 확인해주세요." },
        { status: 422 }
      );
    }

    const result = safeParseDocument(text, file.name);
    if (!result.ok) return NextResponse.json({ message: result.message }, { status: 500 });
    return NextResponse.json(result.preview);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "문서를 처리하는 중 오류가 발생했습니다.";
    console.error("[parse-document] unhandled error:", error);
    return NextResponse.json({ message }, { status: 500 });
  }
}
