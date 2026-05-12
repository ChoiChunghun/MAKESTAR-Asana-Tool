import { NextResponse } from "next/server";
import { extractTextFromPdf } from "@/lib/document/extractPdf";
import { extractTextFromDocx } from "@/lib/document/extractDocx";
import { extractTextFromGoogleDoc } from "@/lib/document/extractGoogleDoc";
import { buildNormalizedData } from "@/lib/parser/parseOverview";
import { buildPreviewData } from "@/lib/parser/buildPreviewData";
import { buildMultiEventData } from "@/lib/parser/multiEvent";
import { getAdminConfig } from "@/lib/adminConfig";
import type { ParseConfig, ParsedPlanResult } from "@/types/parser";

export const runtime = "nodejs";

/** 응답 타입 — 항상 { events, isMultiEvent } 형태로 반환 */
type ParseResponse = {
  events: ParsedPlanResult[];
  isMultiEvent: boolean;
};

// 파서를 안전하게 실행 — 내부 예외가 전체 요청을 망가뜨리지 않도록 격리
function safeParseDocument(text: string, sourceName: string, config?: ParseConfig): { ok: true; data: ParseResponse } | { ok: false; message: string } {
  try {
    // 다중 이벤트 감지 시도
    const multiData = buildMultiEventData(text, sourceName);
    if (multiData && multiData.length >= 2) {
      const events = multiData.map((d) => buildPreviewData(d, config));
      // 섹션명에 부(部) 접미사 추가
      events.forEach((e) => {
        const label = e.normalizedData.partLabel;
        if (label) {
          e.summary.sectionName = `${e.summary.sectionName}_${label}`;
        }
      });
      return { ok: true, data: { events, isMultiEvent: true } };
    }

    // 단일 이벤트
    const normalizedData = buildNormalizedData(text, sourceName);
    const preview = buildPreviewData(normalizedData, config);
    return { ok: true, data: { events: [preview], isMultiEvent: false } };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "문서 파싱 중 알 수 없는 오류가 발생했습니다.";
    console.error("[parse-document] parser threw:", err);
    return { ok: false, message };
  }
}

/** KV admin config → ParseConfig 변환 */
async function loadParseConfig(): Promise<ParseConfig | undefined> {
  if (!process.env.KV_REST_API_URL) return undefined;
  try {
    const cfg = await getAdminConfig();
    if (!cfg) return undefined;
    const pick = <T>(v: unknown, guard: (x: unknown) => x is T): T | undefined =>
      guard(v) ? v : undefined;
    const isStrArr = (v: unknown): v is string[] =>
      Array.isArray(v) && v.every((x) => typeof x === "string");
    return {
      benefitKeywords:       pick(cfg.benefitKeywords, isStrArr),
      benefitExcludeKeywords: pick(cfg.benefitExcludeKeywords, isStrArr),
      pcExcludeKeywords:     pick(cfg.pcExcludeKeywords, isStrArr),
      handwritingKeywords:   pick(cfg.handwritingKeywords, isStrArr),
      vmdConditionLabels:    pick(cfg.vmdConditionLabels, isStrArr),
    };
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  try {
    // 관리자 키워드 설정 로드 (없으면 constants.ts 기본값 사용)
    const parseConfig = await loadParseConfig();

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as {
        googleDocUrl?: string;
        rawText?: string;
        fileName?: string;
      };

      // 브라우저에서 추출한 텍스트 직접 수신 (대용량 docx 우회)
      if (body.rawText) {
        // rawText 크기 제한: 1MB (DoS 방지)
        if (body.rawText.length > 1_048_576) {
          return NextResponse.json(
            { message: "문서 텍스트가 너무 큽니다. 1MB 이하 문서만 처리할 수 있습니다." },
            { status: 413 }
          );
        }
        if (!body.rawText.trim()) {
          return NextResponse.json(
            { message: "문서에서 텍스트를 추출하지 못했습니다." },
            { status: 422 }
          );
        }
        const result = safeParseDocument(body.rawText, body.fileName || "문서", parseConfig);
        if (!result.ok) return NextResponse.json({ message: result.message }, { status: 500 });
        return NextResponse.json(result.data);
      }

      if (!body.googleDocUrl) {
        return NextResponse.json({ message: "Google Doc URL을 입력해주세요." }, { status: 400 });
      }
      // Google Doc URL 형식 검증
      const isValidGoogleDocUrl = /^https:\/\/docs\.google\.com\/document\/d\/[a-zA-Z0-9_-]+/.test(body.googleDocUrl);
      if (!isValidGoogleDocUrl) {
        return NextResponse.json(
          { message: "올바른 Google Doc URL을 입력해주세요. (https://docs.google.com/...)" },
          { status: 400 }
        );
      }
      const text = await extractTextFromGoogleDoc(body.googleDocUrl);
      if (!text.trim()) {
        return NextResponse.json(
          { message: "Google Doc에서 텍스트를 추출하지 못했습니다." },
          { status: 422 }
        );
      }
      const result = safeParseDocument(text, "Google Doc", parseConfig);
      if (!result.ok) return NextResponse.json({ message: result.message }, { status: 500 });
      return NextResponse.json(result.data);
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

    const result = safeParseDocument(text, file.name, parseConfig);
    if (!result.ok) return NextResponse.json({ message: result.message }, { status: 500 });
    return NextResponse.json(result.data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "문서를 처리하는 중 오류가 발생했습니다.";
    console.error("[parse-document] unhandled error:", error);
    return NextResponse.json({ message }, { status: 500 });
  }
}
