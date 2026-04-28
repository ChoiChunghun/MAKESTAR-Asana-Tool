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
import { getProjectLabel } from "./projects";

type ProjectCustomFieldSetting = {
  custom_field?: {
    gid?: string;
    name?: string;
  };
};

type AsanaCustomField = {
  gid: string;
  name: string;
  enum_options?: Array<{
    gid: string;
    name: string;
  }>;
};

type TaskWithCustomFields = {
  custom_fields?: AsanaCustomField[];
};

export type CustomFieldMap = Record<string, string | string[]>;

export async function getProjectCustomFieldMap(projectGid: string): Promise<Record<string, string>> {
  const project = await asanaRequest<{ custom_field_settings?: ProjectCustomFieldSetting[] }>(
    "get",
    `/projects/${projectGid}?opt_fields=custom_field_settings.custom_field.name,custom_field_settings.custom_field.gid`
  );

  const map: Record<string, string> = {};
  for (const setting of project.custom_field_settings || []) {
    const field = setting.custom_field || {};
    if (!field.name || !isValidGid(field.gid)) continue;
    map[normalizeOptionLabel(field.name)] = String(field.gid);
  }
  return map;
}

export async function getNamedProjectFieldGid(projectGid: string, explicitFieldGid: string, fieldName: string): Promise<string> {
  const fieldMap: Record<string, string> = await getProjectCustomFieldMap(projectGid).catch(() => ({}));
  const matched = fieldMap[normalizeOptionLabel(fieldName)] || "";
  if (isValidGid(matched)) return matched;
  if (isValidGid(explicitFieldGid)) return String(explicitFieldGid);
  return "";
}

export async function getCustomFieldEnumOptionMap(fieldGid: string): Promise<Record<string, string>> {
  if (!isValidGid(fieldGid)) return {};

  const field = await asanaRequest<AsanaCustomField>("get", `/custom_fields/${fieldGid}`);
  const map: Record<string, string> = {};

  for (const option of field.enum_options || []) {
    if (!option.name || !isValidGid(option.gid)) continue;
    map[normalizeOptionLabel(option.name)] = String(option.gid);
  }

  return map;
}

export async function getStatusFieldGid(projectGid: string): Promise<string> {
  return getNamedProjectFieldGid(projectGid, CF_STATUS, CF_STATUS_NAME);
}

export async function getTaskTypeFieldGid(projectGid: string): Promise<string> {
  return getNamedProjectFieldGid(projectGid, CF_TASK_TYPE, CF_TASK_TYPE_NAME);
}

export async function getStatusOptionGidByName(optionName: string, projectGid: string): Promise<string> {
  const map = await getCustomFieldEnumOptionMap(await getStatusFieldGid(projectGid));
  return map[normalizeOptionLabel(optionName)] || "";
}

export async function getTaskTypeOptionGidByName(optionName: string, projectGid: string): Promise<string> {
  const map = await getCustomFieldEnumOptionMap(await getTaskTypeFieldGid(projectGid));
  return map[normalizeOptionLabel(optionName)] || "";
}

export async function getEventFieldGid(projectGid: string): Promise<string> {
  return getNamedProjectFieldGid(projectGid, CF_EVENT_TYPE, CF_EVENT_TYPE_NAME);
}

export function mapEventLabelToAsanaOptionLabel(label: OpenEventLabel): string {
  const normalized = normalizeOptionLabel(label);
  const optionLabelMap: Record<string, string> = {
    특전: "특전 (온라인 럭키드로우 포함)",
    "쇼케이스 초대": "쇼케이스 초대",
    투샷회: "투샷회",
    "영통 1": "영통 1",
    "영통 2": "영통 2",
    대면: "대면",
    포토: "포토",
    "오프라인 이벤트": "오프라인 이벤트",
    "오프라인 럭키드로우": "오프라인 럭키드로우",
    펀딩: "펀딩",
    "일반 판매": "일반 판매",
    파생: "파생",
    기타: "기타"
  };

  return optionLabelMap[normalized] || normalized;
}

export async function applyRequiredEnumCustomField(
  customFields: CustomFieldMap,
  fieldGid: string,
  optionGid: string,
  fieldName: string,
  optionName: string,
  projectGid: string
): Promise<void> {
  if (!isValidGid(fieldGid)) {
    throw new Error(`프로젝트 "${await getProjectLabel(projectGid)}"에서 "${fieldName}" 필드를 찾지 못했습니다.`);
  }
  if (!isValidGid(optionGid)) {
    throw new Error(`프로젝트 "${await getProjectLabel(projectGid)}"의 "${fieldName}" 필드에서 "${optionName}" 옵션을 찾지 못했습니다.`);
  }
  customFields[fieldGid] = optionGid;
}

export async function getTaskEventFieldInfo(taskGid: string): Promise<{ fieldGid: string; optionMap: Record<string, string> } | null> {
  if (!isValidGid(taskGid)) return null;

  const task = await asanaRequest<TaskWithCustomFields>(
    "get",
    `/tasks/${taskGid}?opt_fields=custom_fields.name,custom_fields.gid,custom_fields.enum_options.name,custom_fields.enum_options.gid`
  );

  for (const field of task.custom_fields || []) {
    if (normalizeOptionLabel(field.name) !== normalizeOptionLabel(CF_EVENT_TYPE_NAME)) continue;

    const optionMap: Record<string, string> = {};
    for (const option of field.enum_options || []) {
      if (!option.name || !isValidGid(option.gid)) continue;
      optionMap[normalizeOptionLabel(option.name)] = String(option.gid);
    }

    return {
      fieldGid: isValidGid(field.gid) ? String(field.gid) : "",
      optionMap
    };
  }

  return null;
}

export async function setEventFieldOnTask(taskGid: string, eventLabels: OpenEventLabel[]): Promise<void> {
  if (!isValidGid(taskGid)) return;

  const fieldInfo = await getTaskEventFieldInfo(taskGid);
  if (!fieldInfo || !isValidGid(fieldInfo.fieldGid)) return;

  const ids = eventLabels
    .map((label) => fieldInfo.optionMap[normalizeOptionLabel(mapEventLabelToAsanaOptionLabel(label))])
    .filter(isValidGid);

  if (ids.length === 0) return;

  try {
    await asanaRequest("put", `/tasks/${taskGid}`, { custom_fields: { [fieldInfo.fieldGid]: ids } });
  } catch {
    await asanaRequest("put", `/tasks/${taskGid}`, { custom_fields: { [fieldInfo.fieldGid]: ids[0] } }).catch(() => undefined);
  }
}

export async function buildBaseProgressFields(projectGid: string, taskTypeOptionName: string): Promise<CustomFieldMap> {
  const statusFieldGid = await getStatusFieldGid(projectGid);
  const progressOptionGid = await getStatusOptionGidByName(CF_STATUS_PROGRESS_NAME, projectGid);
  const taskTypeFieldGid = await getTaskTypeFieldGid(projectGid);
  const taskTypeOptionGid = await getTaskTypeOptionGidByName(taskTypeOptionName, projectGid);
  const customFields: CustomFieldMap = {};

  await applyRequiredEnumCustomField(customFields, statusFieldGid, progressOptionGid, CF_STATUS_NAME, CF_STATUS_PROGRESS_NAME, projectGid);
  await applyRequiredEnumCustomField(customFields, taskTypeFieldGid, taskTypeOptionGid, CF_TASK_TYPE_NAME, taskTypeOptionName, projectGid);

  return customFields;
}

export async function buildTaskTypeOnlyFields(projectGid: string, taskTypeOptionName: string): Promise<CustomFieldMap> {
  const taskTypeFieldGid = await getTaskTypeFieldGid(projectGid);
  const taskTypeOptionGid = await getTaskTypeOptionGidByName(taskTypeOptionName, projectGid);
  const customFields: CustomFieldMap = {};
  await applyRequiredEnumCustomField(customFields, taskTypeFieldGid, taskTypeOptionGid, CF_TASK_TYPE_NAME, taskTypeOptionName, projectGid);
  return customFields;
}
