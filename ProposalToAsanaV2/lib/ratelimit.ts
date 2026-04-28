/**
 * 인프로세스 슬라이딩 윈도우 rate limiter.
 * Vercel 서버리스 환경에서 동일 인스턴스가 warm 상태로 재사용될 때 유효합니다.
 * 대규모 트래픽이 필요한 경우 Upstash Redis(@upstash/ratelimit)로 교체하세요.
 */

type BucketEntry = { count: number; resetAt: number };

const buckets = new Map<string, BucketEntry>();

const WINDOW_MS = 60_000; // 1분 윈도우
const MAX_PER_WINDOW = 15; // 분당 최대 요청 수

// 오래된 버킷 주기적 정리 (메모리 누수 방지)
let lastCleanup = Date.now();
function cleanupIfNeeded() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60_000) return; // 5분마다
  lastCleanup = now;
  for (const [key, entry] of buckets) {
    if (now > entry.resetAt) buckets.delete(key);
  }
}

/**
 * 요청 허용 여부를 반환.
 * @param identifier  토큰 일부 또는 IP 등 식별자
 * @returns true = 허용, false = 차단
 */
export function checkRateLimit(identifier: string): boolean {
  cleanupIfNeeded();
  const now = Date.now();
  const entry = buckets.get(identifier);

  if (!entry || now > entry.resetAt) {
    buckets.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_PER_WINDOW) return false;
  entry.count++;
  return true;
}

/** 토큰을 직접 노출하지 않는 식별자 생성 (마지막 8자 사용) */
export function tokenToIdentifier(token: string): string {
  return `tok:${token.slice(-8)}`;
}
