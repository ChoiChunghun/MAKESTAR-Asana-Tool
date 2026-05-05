/**
 * 어드민 글로벌 설정 — Vercel KV 저장/읽기
 *
 * Key: "admin:config"
 * 읽기: 공개 (토큰 불필요) — 메인 페이지 초기 로드에 사용
 * 쓰기: 어드민 비밀번호 필요 — /api/admin/config POST에서 처리
 */
import { kv } from "@vercel/kv";

const CONFIG_KEY = "admin:config";

/** KV에서 글로벌 설정 읽기. 저장된 값 없으면 null */
export async function getAdminConfig(): Promise<Record<string, unknown> | null> {
  const raw = await kv.get<string>(CONFIG_KEY);
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** KV에 글로벌 설정 저장 */
export async function saveAdminConfig(config: Record<string, unknown>): Promise<void> {
  await kv.set(CONFIG_KEY, JSON.stringify(config));
}
