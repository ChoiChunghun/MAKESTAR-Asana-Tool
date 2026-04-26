import {
  CF_EVENT_TYPE,
  CF_EVENT_TYPE_NAME,
  CF_STATUS,
  CF_STATUS_NAME,
  CF_STATUS_PROGRESS_NAME,
  CF_TASK_TYPE,
  CF_TASK_TYPE_NAME
} from "@/lib/parser/constants";
import type { OpenEventLabel } from "@/types/parser";
import { isValidGid, normalizeOptionLabel } from "@/lib/parser/utils";
import { asanaRequest } from "./client";

export type CustomFieldMap = Record<string, string | string[]>;

// ── 프로젝트 레벨: 필드명 → GID 조회 ──────────────────────────────────────

type ProjectCustomFieldSetting = {
  custom_field?: { gid?: string; name?: string };
};

type AsanaCustomField = {
  gid: string;
  name: string;
  enum_options?: Array<{ gid: string; name: string }>;
};

type TaskWithCustomFields = {
  custom_fields?: AsanaCustomField[];
};

async function getProjectCustomFieldMap(projectGid: string, token: string): Promise<Record<string, string>> {
  const project = await asanaRequest<{ custom_field_settings?: ProjectCustomFieldSetting[] }>(
    "get",
    `/projects/${projectGid}?opt_fields=custom_field_settings.custom_field.name,custom_field_settings.custom_field.gid`,
    token
  );
  const map: Record<string, string> = {};
  for (const setting of project.custom_field_settings || []) {
    const field = setting.custom_field || {};
    if (!field.name || !isValidGid(field.gid)) continue;
    map[normalizeOptionLabel(field.name)] = String(field.gid);
  }
  return map;
}

async function getNamedProjectFieldGid(
  projectGid: string,
  explicitGid: string,
  fieldName: string,
  token: string
): Promise<string> {
  const fieldMap = await getProjectCustomFieldMap(projectGid, token).catch(() => ({} as Record<string, string>));
  const matched = fieldMap[normalizeOptionLabel(fieldName)] || "";
  if (isValidGid(matched)) return matched;
  if (isValidGid(explicitGid)) return String(explicitGid);
  return "";
}

async function getCustomFieldEnumOptionMap(fieldGid: string, token: string): Promise<Record<string, string>> {
  if (!isValidGid(fieldGid)) return {};
  const field = await asanaRequest<AsanaCustomField>("get", `/custom_fields/${fieldGid}`, token);
  const map: Record<string, string> = {};
  for (const option of field.enum_options || []) {
    if (!option.name || !isValidGid(option.gid)) continue;
    map[normalizeOptionLabel(option.name)] = String(option.gid);
  }
  return map;
}

async function getStatusFieldGid(projectGid: string, token: string): Promise<string> {
  return getNamedProjectFieldGid(projectGid, CF_STATUS, CF_STATUS_NAME, token);
}

async function getTaskTypeFieldGid(projectGid: string, token: string): Promise<string> {
  return getNamedProjectFieldGid(projectGid, CF_TASK_TYPE, CF_TASK_TYPE_NAME, token);
}

async function getEventFieldGid(projectGid: string, token: string): Promise<string> {
  return getNamedProjectFieldGid(projectGid, CF_EVENT_TYPE, CF_EVENT_TYPE_NAME, token);
}

async function getStatusOptionGidByName(optionName: string, projectGid: string, token: string): Promise<string> {
  const map = await getCustomFieldEnumOptionMap(await getStatusFieldGid(projectGid, token), token);
  return map[normalizeOptionLabel(optionName)] || "";
}

async function getTaskTypeOptionGidByName(optionName: string, projectGid: string, token: string): Promise<string> {
  const map = await getCustomFieldEnumOptionMap(await getTaskTypeFieldGid(projectGid, token), token);
  return map[normalizeOptionLabel(optionName)] || "";
}

// ── 커스텀 필드 맵에 enum 필드 추가 (필드/옵션 GID 미확보 시 에러) ─────────

async function applyRequiredEnumCustomField(
  customFields: CustomFieldMap,
  fieldGid: string,
  optionGid: string,
  fieldName: string,
  optionName: string
): Promise<void> {
  if (!isValidGid(fieldGid)) {
    throw new Error(`"${fieldName}" 필드를 찾지 못했습니다. 프로젝트에 해당 커스텀 필드가 있는지 확인해주세요.`);
  }
  if (!isValidGid(optionGid)) {
    throw new Error(`"${fieldName}" 필드에서 "${optionName}" 옵션을 찾지 못했습니다.`);
  }
  customFields[fieldGid] = optionGid;
}

// ── 태스크 생성용 커스텀 필드 빌더 ─────────────────────────────────────────

/**
 * 부모 태스크용: 상태(진행) + 태스크 구분
 * 필드/옵션 GID를 Asana API에서 이름 기반으로 동적 조회
 */
export async function buildBaseProgressFields(
  projectGid: string,
  taskTypeOptionName: string,
  token: string
): Promise<CustomFieldMap> {
  const [statusFieldGid, taskTypeFieldGid] = await Promise.all([
    getStatusFieldGid(projectGid, token),
    getTaskTypeFieldGid(projectGid, token)
  ]);
  const [progressOptionGid, taskTypeOptionGid] = await Promise.all([
    getStatusOptionGidByName(CF_STATUS_PROGRESS_NAME, projectGid, token),
    getTaskTypeOptionGidByName(taskTypeOptionName, projectGid, token)
  ]);
  const customFields: CustomFieldMap = {};
  await applyRequiredEnumCustomField(customFields, statusFieldGid, progressOptionGid, CF_STATUS_NAME, CF_STATUS_PROGRESS_NAME);
  await applyRequiredEnumCustomField(customFields, taskTypeFieldGid, taskTypeOptionGid, CF_TASK_TYPE_NAME, taskTypeOptionName);
  return customFields;
}

/**
 * 서브태스크용: 태스크 구분만
 */
export async function buildTaskTypeOnlyFields(
  projectGid: string,
  taskTypeOptionName: string,
  token: string
): Promise<CustomFieldMap> {
  const taskTypeFieldGid = await getTaskTypeFieldGid(projectGid, token);
  const taskTypeOptionGid = await getTaskTypeOptionGidByName(taskTypeOptionName, projectGid, token);
  const customFields: CustomFieldMap = {};
  await applyRequiredEnumCustomField(customFields, taskTypeFieldGid, taskTypeOptionGid, CF_TASK_TYPE_NAME, taskTypeOptionName);
  return customFields;
}

// ── 이벤트 구분 (multi-enum) 설정 ──────────────────────────────────────────

/** 내부 레이블 → Asana 실제 옵션 이름 매핑 */
function mapEventLabelToAsanaOptionLabel(label: OpenEventLabel): string {
  const map: Record<string, string> = {
    "특전":             "특전 (온라인 럭키드로우 포함)",
    "쇼케이스 초대":    "쇼케이스 초대",
    "투샷회":           "투샷회",
    "영통 1":           "영통 1",
    "영통 2":           "영통 2",
    "대면":             "대면",
    "포토":             "포토",
    "오프라인 이벤트":  "오프라인 이벤트",
    "오프라인 럭키드로우": "오프라인 럭키드로우",
    "펀딩":             "펀딩",
    "일반 판매":        "일반 판매",
    "파생":             "파생",
    "기타":             "기타"
  };
  return map[label] ?? label;
}

/**
 * 태스크 생성 후 이벤트 구분 필드 설정 (multi-enum).
 * 태스크의 custom_fields에서 "이벤트 구분" 필드를 이름으로 찾아 옵션 GID를 동적 조회.
 * 실패 시 에러를 그대로 던짐 (호출자가 safeSetEventField로 감싸서 처리).
 */
export async function setEventFieldOnTask(
  taskGid: string,
  labels: OpenEventLabel[],
  token: string
): Promise<void> {
  if (!isValidGid(taskGid) || !labels.length) return;

  // 태스크의 custom_fields에서 "이벤트 구분" 필드 조회 (이름 기반)
  const task = await asanaRequest<TaskWithCustomFields>(
    "get",
    `/tasks/${taskGid}?opt_fields=custom_fields.name,custom_fields.gid,custom_fields.enum_options.name,custom_fields.enum_options.gid`,
    token
  );

  let fieldGid = "";
  const optionMap: Record<string, string> = {};

  for (const field of task.custom_fields || []) {
    if (normalizeOptionLabel(field.name) !== normalizeOptionLabel(CF_EVENT_TYPE_NAME)) continue;
    fieldGid = isValidGid(field.gid) ? String(field.gid) : "";
    for (const option of field.enum_options || []) {
      if (!option.name || !isValidGid(option.gid)) continue;
      optionMap[normalizeOptionLabel(option.name)] = String(option.gid);
    }
    break;
  }

  if (!isValidGid(fieldGid)) return; // 프로젝트에 이벤트 구분 필드 없으면 무시

  const ids = labels
    .map((label) => optionMap[normalizeOptionLabel(mapEventLabelToAsanaOptionLabel(label))])
    .filter(isValidGid);

  if (!ids.length) return;

  // multi-enum: GID 배열로 전달
  await asanaRequest("put", `/tasks/${taskGid}`, token, {
    custom_fields: { [fieldGid]: ids }
  });
}
