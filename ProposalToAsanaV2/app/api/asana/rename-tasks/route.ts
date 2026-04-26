import { NextResponse } from "next/server";
import { asanaRequest, validateToken } from "@/lib/asana/client";

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
      return NextResponse.json({ message: errors.join("\n") }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "이름 변경 중 오류가 발생했습니다.";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
