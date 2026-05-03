import { NextResponse } from "next/server";
import { getActivityLog, clearActivityLog } from "@/lib/activityLog";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";

function checkAdminPassword(req: Request): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  const header = req.headers.get("x-admin-password") || "";
  if (!header) return false;
  try {
    const a = Buffer.from(pw,     "utf8");
    const b = Buffer.from(header, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** GET /api/admin/activity?limit=N — 생성 이력 조회 */
export async function GET(req: Request) {
  if (!checkAdminPassword(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.KV_REST_API_URL) {
    return NextResponse.json({ message: "KV not configured" }, { status: 503 });
  }
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
  const entries = await getActivityLog(limit);
  return NextResponse.json({ entries, total: entries.length });
}

/** DELETE /api/admin/activity — 전체 이력 삭제 */
export async function DELETE(req: Request) {
  if (!checkAdminPassword(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.KV_REST_API_URL) {
    return NextResponse.json({ message: "KV not configured" }, { status: 503 });
  }
  await clearActivityLog();
  return NextResponse.json({ ok: true });
}
