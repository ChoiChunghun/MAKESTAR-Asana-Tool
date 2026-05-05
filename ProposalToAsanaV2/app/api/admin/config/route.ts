import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getAdminConfig, saveAdminConfig } from "@/lib/adminConfig";

export const runtime = "nodejs";

function checkAdminPassword(req: Request): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  const header = req.headers.get("x-admin-password") || "";
  if (!header || header.length > 256) return false;
  try {
    const a = Buffer.from(pw, "utf8");
    const b = Buffer.from(header, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** GET /api/admin/config — 글로벌 디폴트 설정 읽기 (인증 불필요) */
export async function GET() {
  if (!process.env.KV_REST_API_URL) {
    return NextResponse.json({ config: null }, { status: 200 });
  }
  const config = await getAdminConfig();
  return NextResponse.json({ config });
}

/** POST /api/admin/config — 글로벌 디폴트 설정 저장 (어드민 비밀번호 필요) */
export async function POST(req: Request) {
  if (!checkAdminPassword(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.KV_REST_API_URL) {
    return NextResponse.json({ message: "KV not configured" }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }
  await saveAdminConfig(body as Record<string, unknown>);
  return NextResponse.json({ ok: true });
}
