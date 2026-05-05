import { NextResponse } from "next/server";
import { asanaRequest, validateToken } from "@/lib/asana/client";
import { toApiResponse } from "@/lib/asana/errors";

export const runtime = "nodejs";

type RenameRequest = {
  asanaToken: string;
  sectionGid?: string;
  newSectionName?: string;
  tasks?: { gid: string; name: string }[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RenameRequest;
    validateToken(body.asanaToken);

    const errors: string[] = [];

    // 섹션 이름 변경
    if (body.sectionGid && body.newSectionName) {
      try {
        await asanaRequest("put", `/sections/${body.sectionGid}`, body.asanaToken, {
          name: body.newSectionName
        });
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 404) {
          errors.push("섹션이 이미 삭제되었습니다.");
        } else {
          errors.push(`섹션 이름 변경 실패: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // 태스크 이름 일괄 변경
    for (const task of body.tasks ?? []) {
      try {
        await asanaRequest("put", `/tasks/${task.gid}`, body.asanaToken, {
          name: task.name
        });
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 404) {
          errors.push(`태스크 ${task.gid}가 이미 삭제되었습니다.`);
        } else {
          errors.push(`태스크 ${task.gid} 이름 변경 실패`);
        }
      }
    }

    if (errors.length) {
      // 일부 항목 처리 실패 (삭제된 태스크 등) → 422 Unprocessable
      return NextResponse.json({ message: errors.join("\n") }, { status: 422 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { message, status } = toApiResponse(error);
    return NextResponse.json({ message }, { status });
  }
}
