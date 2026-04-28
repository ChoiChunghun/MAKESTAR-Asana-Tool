import type { AsanaCreateTasksRequest, AsanaCreateTasksResponse, CreatedAsanaTask } from "@/types/asana";
import type { DueFields, PreviewTaskRow, TaskKey } from "@/types/parser";
import {
  DUE_DAYS_OFFSET,
  TASK_TYPE_NAME_ETC,
  TASK_TYPE_NAME_MD,
  TASK_TYPE_NAME_OPEN,
  TASK_TYPE_NAME_PC,
  TASK_TYPE_NAME_UPDATE,
  TASK_TYPE_NAME_VMD
} from "@/lib/parser/constants";
import { buildBenefitDescription, buildOpenDescription, buildPhotocardDescription, buildUpdateDescription, buildVmdDescription } from "@/lib/parser/descriptions";
import { getTaskDueFields } from "@/lib/parser/parseDeadline";
import { getDueDate, isValidGid } from "@/lib/parser/utils";
import { asanaRequest, getAssigneeGid } from "./client";
import { addTaskToSection, getOrCreateSection } from "./sections";
import { buildBaseProgressFields, buildTaskTypeOnlyFields, setEventFieldOnTask } from "./customFields";

type AsanaTaskPayload = {
  name: string;
  projects?: string[];
  parent?: string;
  assignee?: string;
  due_on?: string;
  due_at?: string;
  notes?: string;
  html_notes?: string;
  followers?: string[];
  custom_fields?: Record<string, string | string[]>;
};

type AsanaTaskResult = {
  gid: string;
  name: string;
};

type TaskCreateContext = {
  request: AsanaCreateTasksRequest;
  sectionGid: string;
  rowMap: Map<TaskKey, PreviewTaskRow>;
  createdTasks: CreatedAsanaTask[];
};

export async function createTasksFromPreview(request: AsanaCreateTasksRequest): Promise<AsanaCreateTasksResponse> {
  if (!isValidGid(request.projectGid)) {
    throw new Error("Asana 프로젝트를 선택해주세요.");
  }
  if (!request.sectionName?.trim()) {
    throw new Error("섹션명을 입력해주세요.");
  }

  const sectionGid = await getOrCreateSection(request.projectGid, request.sectionName.trim());
  const rowMap = new Map(request.rows.map((row) => [row.key, row]));
  const context: TaskCreateContext = {
    request,
    sectionGid,
    rowMap,
    createdTasks: []
  };

  if (isRowEnabled(rowMap, "winner")) await createWinnerAnnouncementTask(context);
  if (isRowEnabled(rowMap, "vmd")) await createVmdTask(context);
  if (isRowEnabled(rowMap, "md")) await createMdTasks(context);
  if (isRowEnabled(rowMap, "up")) await createUpdateTasks(context);
  if (isRowEnabled(rowMap, "open")) await createOpenTasks(context);

  return {
    projectGid: request.projectGid,
    projectUrl: `https://app.asana.com/0/${request.projectGid}`,
    sectionGid,
    createdTasks: context.createdTasks
  };
}

async function createMdTasks(context: TaskCreateContext): Promise<void> {
  const { request, rowMap } = context;
  const { summary } = request.plan;
  const projectGid = request.projectGid;
  const dueFields = getTaskDueFields(request.plan.normalizedData, "md");
  const mdName = rowTitle(rowMap, "md", `[${summary.productCode}] MD`);
  const pcTaskName = rowTitle(rowMap, "pc", `[${summary.productCode}] 포토카드 / ${summary.photocards.length}세트 총 ${summary.photocardTotal}종`);
  const spTaskName = rowTitle(rowMap, "sp", `[${summary.productCode}] 특전 / ${summary.benefits.length}종 총 ${summary.benefitTotal}종`);

  const mdPayload: AsanaTaskPayload = {
    name: mdName,
    projects: [projectGid],
    assignee: getAssigneeGid(),
    notes: '발주 후 "완료" 처리 부탁드립니다!',
    followers: [getAssigneeGid()],
    custom_fields: await buildBaseProgressFields(projectGid, TASK_TYPE_NAME_MD)
  };
  applyDueFields(mdPayload, dueFields);
  const mdGid = await createTask(mdPayload);
  await addTaskToSection(mdGid, context.sectionGid);
  recordCreatedTask(context, "md", mdGid, mdName);

  if (summary.photocards.length > 0 && isRowEnabled(rowMap, "pc")) {
    const pcPayload: AsanaTaskPayload = {
      name: pcTaskName,
      parent: mdGid,
      assignee: getAssigneeGid(),
      html_notes: buildPhotocardDescription(summary.photocards),
      followers: [getAssigneeGid()],
      custom_fields: await buildTaskTypeOnlyFields(projectGid, TASK_TYPE_NAME_PC)
    };
    applyDueFields(pcPayload, dueFields);
    const pcGid = await createTask(pcPayload);
    recordCreatedTask(context, "pc", pcGid, pcTaskName);
  }

  if (summary.benefits.length > 0 && isRowEnabled(rowMap, "sp")) {
    const spPayload: AsanaTaskPayload = {
      name: spTaskName,
      parent: mdGid,
      assignee: getAssigneeGid(),
      html_notes: buildBenefitDescription(summary.benefits),
      followers: [getAssigneeGid()],
      custom_fields: await buildTaskTypeOnlyFields(projectGid, TASK_TYPE_NAME_MD)
    };
    applyDueFields(spPayload, dueFields);
    const spGid = await createTask(spPayload);
    recordCreatedTask(context, "sp", spGid, spTaskName);
  }
}

async function createUpdateTasks(context: TaskCreateContext): Promise<void> {
  const { request, rowMap } = context;
  const { summary } = request.plan;
  const projectGid = request.projectGid;
  const dueFields = getTaskDueFields(request.plan.normalizedData, "update");
  const outputCount = summary.photocards.length + summary.benefits.length;
  const upName = rowTitle(rowMap, "up", `[${summary.productCode}] 업데이트`);
  const upSubName = rowTitle(rowMap, "upsub", `[${summary.productCode}] 업데이트 / ${outputCount}종`);

  const upPayload: AsanaTaskPayload = {
    name: upName,
    projects: [projectGid],
    assignee: getAssigneeGid(),
    notes: 'SNS 발행 후 "완료" 처리 부탁드립니다!',
    followers: [getAssigneeGid()],
    custom_fields: await buildBaseProgressFields(projectGid, TASK_TYPE_NAME_UPDATE)
  };
  applyDueFields(upPayload, dueFields);
  const upGid = await createTask(upPayload);
  await addTaskToSection(upGid, context.sectionGid);
  recordCreatedTask(context, "up", upGid, upName);

  if (isRowEnabled(rowMap, "upsub")) {
    const upSubPayload: AsanaTaskPayload = {
      name: upSubName,
      parent: upGid,
      assignee: getAssigneeGid(),
      html_notes: buildUpdateDescription(summary.photocards, summary.benefits),
      followers: [getAssigneeGid()],
      custom_fields: await buildTaskTypeOnlyFields(projectGid, TASK_TYPE_NAME_UPDATE)
    };
    applyDueFields(upSubPayload, dueFields);
    const upSubGid = await createTask(upSubPayload);
    recordCreatedTask(context, "upsub", upSubGid, upSubName);
  }
}

async function createOpenTasks(context: TaskCreateContext): Promise<void> {
  const { request, rowMap } = context;
  const { summary, openContext } = request.plan;
  const projectGid = request.projectGid;
  const dueFields = getTaskDueFields(request.plan.normalizedData, "open");
  const openName = rowTitle(rowMap, "open", `[${summary.productCode}] 오픈`);
  const openDesignName = rowTitle(rowMap, "opendesign", `[${summary.productCode}] 오픈 디자인`);

  const openPayload: AsanaTaskPayload = {
    name: openName,
    projects: [projectGid],
    assignee: getAssigneeGid(),
    notes: '페이지 작업 후 "완료" 처리 부탁드립니다!',
    followers: [getAssigneeGid()],
    custom_fields: await buildBaseProgressFields(projectGid, TASK_TYPE_NAME_OPEN)
  };
  applyDueFields(openPayload, dueFields);
  const openGid = await createTask(openPayload);
  await addTaskToSection(openGid, context.sectionGid);
  await setEventFieldOnTask(openGid, openContext.eventLabels);
  recordCreatedTask(context, "open", openGid, openName);

  if (isRowEnabled(rowMap, "opendesign")) {
    const openDesignPayload: AsanaTaskPayload = {
      name: openDesignName,
      parent: openGid,
      assignee: getAssigneeGid(),
      html_notes: buildOpenDescription(openContext),
      followers: [getAssigneeGid()],
      custom_fields: await buildTaskTypeOnlyFields(projectGid, TASK_TYPE_NAME_OPEN)
    };
    applyDueFields(openDesignPayload, dueFields);
    const openDesignGid = await createTask(openDesignPayload);
    await setEventFieldOnTask(openDesignGid, openContext.eventLabels);
    recordCreatedTask(context, "opendesign", openDesignGid, openDesignName);
  }
}

async function createVmdTask(context: TaskCreateContext): Promise<void> {
  const { request, rowMap } = context;
  const { summary, openContext } = request.plan;
  const projectGid = request.projectGid;
  const dueFields = getTaskDueFields(request.plan.normalizedData, "vmd");
  const vmdName = rowTitle(rowMap, "vmd", `[${summary.productCode}] VMD`);
  const vmdChildName = rowTitle(rowMap, "vmdsub", `[${summary.productCode}] VMD / (${openContext.vmdItemCount})종`);

  const vmdPayload: AsanaTaskPayload = {
    name: vmdName,
    projects: [projectGid],
    assignee: getAssigneeGid(),
    notes: '발주 후 "완료" 처리 부탁드립니다!',
    followers: [getAssigneeGid()],
    custom_fields: await buildBaseProgressFields(projectGid, TASK_TYPE_NAME_VMD)
  };
  applyDueFields(vmdPayload, dueFields);
  const vmdGid = await createTask(vmdPayload);
  await addTaskToSection(vmdGid, context.sectionGid);
  recordCreatedTask(context, "vmd", vmdGid, vmdName);

  if (isRowEnabled(rowMap, "vmdsub")) {
    const vmdChildPayload: AsanaTaskPayload = {
      name: vmdChildName,
      parent: vmdGid,
      assignee: getAssigneeGid(),
      html_notes: buildVmdDescription(openContext),
      followers: [getAssigneeGid()],
      custom_fields: await buildTaskTypeOnlyFields(projectGid, TASK_TYPE_NAME_VMD)
    };
    applyDueFields(vmdChildPayload, dueFields);
    const vmdChildGid = await createTask(vmdChildPayload);
    recordCreatedTask(context, "vmdsub", vmdChildGid, vmdChildName);
  }
}

async function createWinnerAnnouncementTask(context: TaskCreateContext): Promise<void> {
  const { request, rowMap } = context;
  const { summary } = request.plan;
  const projectGid = request.projectGid;
  const winnerName = rowTitle(rowMap, "winner", `[${summary.productCode}] 당첨자 선정`);
  const winnerPayload: AsanaTaskPayload = {
    name: winnerName,
    projects: [projectGid],
    assignee: getAssigneeGid(),
    due_on: getDueDate(DUE_DAYS_OFFSET),
    notes: "당첨자 관련 업무 스케줄링을 위한 태스크입니다!",
    custom_fields: await buildBaseProgressFields(projectGid, TASK_TYPE_NAME_ETC)
  };

  const winnerGid = await createTask(winnerPayload);
  await addTaskToSection(winnerGid, context.sectionGid);
  recordCreatedTask(context, "winner", winnerGid, winnerName);
}

async function createTask(payload: AsanaTaskPayload): Promise<string> {
  const task = await asanaRequest<AsanaTaskResult>("post", "/tasks", payload);
  return task.gid;
}

function applyDueFields(payload: AsanaTaskPayload, dueFields: DueFields): void {
  delete payload.due_on;
  delete payload.due_at;

  if (dueFields.due_at) {
    payload.due_at = dueFields.due_at;
    return;
  }

  if (dueFields.due_on) {
    payload.due_on = dueFields.due_on;
  }
}

function rowTitle(rowMap: Map<TaskKey, PreviewTaskRow>, key: TaskKey, fallback: string): string {
  return rowMap.get(key)?.title?.trim() || fallback;
}

function isRowEnabled(rowMap: Map<TaskKey, PreviewTaskRow>, key: TaskKey): boolean {
  const row = rowMap.get(key);
  if (!row || !row.available || !row.enabled) return false;
  if (row.parentKey) return isRowEnabled(rowMap, row.parentKey);
  return true;
}

function recordCreatedTask(context: TaskCreateContext, key: string, gid: string, name: string): void {
  context.createdTasks.push({
    key,
    gid,
    name,
    url: `https://app.asana.com/0/${context.request.projectGid}/${gid}`
  });
}
