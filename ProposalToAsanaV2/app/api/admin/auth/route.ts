import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/admin/auth
 * Body: { password: string }
 * 환경변수 ADMIN_PASSWORD와 비교해 인증 여부를 반환.
 * 비밀번호는 서버에서만 확인 — 클라이언트 번들에 노출되지 않음.
 */
export async function POST(request: Request) {
  try {
    const { password } = (await request.json()) as { password?: string };

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      // 환경변수 미설정 시 관리자 기능 비활성화
      return NextResponse.json({ ok: false, message: "관리자 비밀번호가 설정되지 않았습니다." }, { status: 503 });
    }

    if (!password || password.trim() === "") {
      return NextResponse.json({ ok: false, message: "비밀번호를 입력해주세요." }, { status: 400 });
    }

    // 타이밍 공격 방지: 길이 노출 없이 안전 비교
    const ok = timingSafeEqual(password, adminPassword);
    if (!ok) {
      return NextResponse.json({ ok: false, message: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "인증 중 오류가 발생했습니다." }, { status: 500 });
  }
}

/** 문자열을 고정 시간에 비교 (타이밍 공격 방지) */
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = Buffer.from(a);
  const bBytes = Buffer.from(b);
  if (aBytes.length !== bBytes.length) {
    // 길이가 다르더라도 전체 비교를 수행해 길이 노출 방지
    let diff = aBytes.length ^ bBytes.length;
    const minLen = Math.min(aBytes.length, bBytes.length);
    for (let i = 0; i < minLen; i++) diff |= aBytes[i] ^ bBytes[i];
    return false;
  }
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}
