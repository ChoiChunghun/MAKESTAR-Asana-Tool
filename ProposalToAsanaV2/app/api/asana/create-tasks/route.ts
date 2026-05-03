import { NextResponse } from "next/server";
import type { AsanaCreateTasksRequest } from "@/types/asana";
import { createTasksFromPreview } from "@/lib/asana/tasks";
import { toUserFriendlyAsanaError } from "@/lib/asana/errors";
import { checkRateLimit, tokenToIdentifier } from "@/lib/ratelimit";
import { pushActivityLog } from "@/lib/activityLog";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AsanaCreateTasksRequest;

    // Rate limit: 동일 토큰으로 분당 15회 이상 요청 차단
    const identifier = tokenToIdentifier(body.asanaToken || "");
    if (!checkRateLimit(identifier)) {
      return NextResponse.json(
        { message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      );
    }

    const result = await createTasksFromPreview(body);

    // KV 로깅 — 실패해도 태스크 생성 결과에 영향 없음
    if (process.env.KV_REST_API_URL) {
      pushActivityLog({
        projectName:  body.projectName ?? body.projectGid,
        sectionName:  body.sectionName ?? "",
        artistName:   body.plan.normalizedData?.artistName ?? "",
        albumName:    body.plan.normalizedData?.albumName ?? "",
        eventLabels:  body.plan.openContext?.eventLabels ?? [],
        taskCount:    result.createdTasks?.length ?? 0,
        tokenHint:    (body.asanaToken || "").slice(-4),
        isDerivative: !!body.derivative
      }).catch(() => { /* silent */ });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: toUserFriendlyAsanaError(error) }, { status: 500 });
  }
}
