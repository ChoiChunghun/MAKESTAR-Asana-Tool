import type { AsanaProject } from "@/types/asana";
import { asanaRequest } from "./client";

type AsanaWorkspace = { gid: string; name: string };
type AsanaProjectRaw = { gid: string; name: string; archived: boolean };

/** 노출할 프로젝트 이름 목록 (순서대로 표시) */
const ALLOWED_PROJECT_NAMES: string[] = [
  "MKS Event / 2026",
  "MKS Event / 해외 단독 / 2026",
  "MKS Event / 2팀 / 2026",
  "MKS Event / B2B, SPACE, ETC / 2026",
  "TESTFARM"
];

export async function getAvailableProjects(token: string): Promise<AsanaProject[]> {
  const workspaces = await asanaRequest<AsanaWorkspace[]>("get", "/workspaces", token);
  if (!workspaces?.length) return [];

  const workspaceGid = workspaces[0].gid;
  const projects = await asanaRequest<AsanaProjectRaw[]>(
    "get",
    `/projects?workspace=${workspaceGid}&limit=100&opt_fields=gid,name,archived`,
    token
  );

  const all = (projects || []).filter((p) => !p.archived);

  // ALLOWED_PROJECT_NAMES 에 있는 것만, 지정된 순서로 반환
  const ordered: AsanaProject[] = [];
  for (const allowedName of ALLOWED_PROJECT_NAMES) {
    const found = all.find((p) => p.name.trim() === allowedName.trim());
    if (found) ordered.push({ gid: found.gid, name: found.name });
  }

  // 매칭된 게 없으면 archived 제외 전체를 알파벳 정렬로 fallback
  return ordered.length > 0
    ? ordered
    : all.map((p) => ({ gid: p.gid, name: p.name })).sort((a, b) => a.name.localeCompare(b.name));
}
