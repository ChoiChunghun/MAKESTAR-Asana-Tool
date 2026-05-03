/**
 * 태스크 생성 이력 로깅 (Vercel KV)
 *
 * 구조: Redis List — LPUSH로 최신 순 저장, LTRIM으로 최대 500건 유지
 * Key: "activity:log"
 */
import { kv } from "@vercel/kv";

export type ActivityEntry = {
  id: string;            // `${ts}-${random}`
  ts: number;            // Unix ms
  projectName: string;   // Asana 프로젝트명
  sectionName: string;   // 섹션명 (이벤트명)
  artistName: string;    // 아티스트명
  albumName: string;     // 앨범명
  eventLabels: string[]; // 이벤트 구분 라벨
  taskCount: number;     // 생성된 태스크 수
  tokenHint: string;     // 토큰 마지막 4자리 (익명화)
  isDerivative: boolean; // 파생 모드 여부
};

const LOG_KEY = "activity:log";
const MAX_ENTRIES = 500;

export async function pushActivityLog(entry: Omit<ActivityEntry, "id" | "ts">): Promise<void> {
  const full: ActivityEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    ...entry
  };
  await kv.lpush(LOG_KEY, JSON.stringify(full));
  await kv.ltrim(LOG_KEY, 0, MAX_ENTRIES - 1);
}

export async function getActivityLog(limit = 100): Promise<ActivityEntry[]> {
  const raw = await kv.lrange<string>(LOG_KEY, 0, limit - 1);
  return raw
    .map((item) => {
      try {
        return typeof item === "string" ? JSON.parse(item) as ActivityEntry : item as ActivityEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is ActivityEntry => e !== null);
}

export async function clearActivityLog(): Promise<void> {
  await kv.del(LOG_KEY);
}
