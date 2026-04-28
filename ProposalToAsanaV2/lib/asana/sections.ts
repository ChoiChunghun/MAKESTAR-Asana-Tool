import { asanaRequest } from "./client";

type AsanaSection = { gid: string; name: string };

export async function getOrCreateSection(projectGid: string, sectionName: string, token: string): Promise<string> {
  const sections = await asanaRequest<AsanaSection[]>(
    "get",
    `/projects/${projectGid}/sections?opt_fields=gid,name`,
    token
  );

  const existing = (sections || []).find(
    (s) => s.name.trim().toLowerCase() === sectionName.trim().toLowerCase()
  );
  if (existing) return existing.gid;

  // 신규 섹션을 현재 첫 번째 섹션 앞에 삽입 → 프로젝트 최상단 배치
  const firstSectionGid = (sections || [])[0]?.gid;
  const body: Record<string, string> = { name: sectionName };
  if (firstSectionGid) body.insert_before = firstSectionGid;

  const created = await asanaRequest<AsanaSection>(
    "post",
    `/projects/${projectGid}/sections`,
    token,
    body
  );

  return created.gid;
}

/**
 * 프로젝트 내 섹션 중 상품코드를 포함하는 섹션을 찾아 반환 (없으면 null).
 * 단순 contains 매칭이므로 고유한 코드 사용을 권장.
 */
export async function findSectionByProductCode(
  projectGid: string,
  productCode: string,
  token: string
): Promise<{ gid: string; name: string } | null> {
  const code = productCode.trim();
  if (!code) return null;
  const sections = await asanaRequest<{ gid: string; name: string }[]>(
    "get",
    `/projects/${projectGid}/sections?opt_fields=gid,name`,
    token
  );
  // 단순 substring 오탐 방지: 앞뒤가 영숫자가 아닌 경계에서만 매칭
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundary = new RegExp(`(?<![\\w가-힣])${escaped}(?![\\w가-힣])`);
  return (sections || []).find((s) => boundary.test(s.name)) ?? null;
}

/** 섹션의 첫 번째 태스크 GID를 반환 (없으면 null) */
export async function getFirstTaskInSection(sectionGid: string, token: string): Promise<string | null> {
  try {
    const tasks = await asanaRequest<{ gid: string }[]>(
      "get",
      `/sections/${sectionGid}/tasks?opt_fields=gid&limit=1`,
      token
    );
    return tasks?.[0]?.gid ?? null;
  } catch {
    return null;
  }
}

/**
 * 태스크를 섹션에 추가.
 * insertBeforeGid 지정 시 해당 태스크 앞에 삽입 (최상단 배치에 사용).
 */
export async function addTaskToSection(
  taskGid: string,
  sectionGid: string,
  token: string,
  insertBeforeGid?: string
): Promise<void> {
  const body: Record<string, string> = { task: taskGid };
  if (insertBeforeGid) body.insert_before = insertBeforeGid;
  await asanaRequest("post", `/sections/${sectionGid}/addTask`, token, body);
}
