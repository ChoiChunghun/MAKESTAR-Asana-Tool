import type { AsanaCreateTasksRequest, AsanaCreateTasksResponse, CreatedAsanaTask } from "@/types/asana";
import type { DueFields, OpenEventLabel, PreviewTaskRow, TaskKey } from "@/types/parser";
import {
  TASK_TYPE_NAME_ETC,
  TASK_TYPE_NAME_MD,
  TASK_TYPE_NAME_OPEN,
  TASK_TYPE_NAME_PC,
  TASK_TYPE_NAME_UPDATE,
  TASK_TYPE_NAME_VMD
} from "@/lib/parser/constants";
import {
  buildAdminRegDescription,
  buildBenefitDescription,
  buildOpenDescription,
  buildPhotocardDescription,
  buildSiteLangDescription,
  buildSnsOpenDescription,
  buildUpdateDescription,
  buildVmdDescription,
  buildYdnAdminRegDescription
} from "@/lib/parser/descriptions";
import { getTaskDueFields, getWinnerDueFields } from "@/lib/parser/parseDeadline";
import { resolveVmdSubName } from "@/lib/parser/parseOpenContext";
import { isValidGid } from "@/lib/parser/utils";
import { asanaRequest, getCurrentUserGid, validateToken } from "./client";
import { addTaskToSection, getFirstTaskInSection, getOrCreateSection } from "./sections";
import {
  buildBaseProgressFields,
  buildTaskTypeOnlyFields,
  setEventFieldOnTask
} from "./customFields";

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

type TaskCreateContext = {
  request: AsanaCreateTasksRequest;
  sectionGid: string;
  rowMap: Map<TaskKey, PreviewTaskRow>;
  createdTasks: CreatedAsanaTask[];
  token: string;
  projectGid: string;
  requesterGid: string;   // 토큰 사용자 (부모 태스크 담당자)
  designerGid: string;    // 디자인 서브태스크 담당자
  topLevelTaskGids: string[];   // 섹션 최상단 정렬용 (생성 순서대로 push)
  eventLabels: OpenEventLabel[]; // 이벤트 구분 커스텀 필드에 사용
  followerGids: string[];        // 협업 참여자 — 모든 태스크에 일괄 적용
  productRegFollowerGids: string[]; // 상품 등록 전용 협업 참여자 (시트 언어 검수·어드민 상품 등록)
  eventFieldErrors: string[];    // 이벤트 구분 필드 설정 실패 수집 (태스크 생성은 계속)
  isDerivative: boolean;         // 파생 모드 여부
};

/** 이벤트 구분 필드 설정 실패 시 에러 메시지를 context에 수집하고 태스크 생성은 계속 진행 */
async function safeSetEventField(
  taskGid: string,
  labels: OpenEventLabel[],
  ctx: TaskCreateContext,
  taskName?: string
): Promise<void> {
  try {
    await setEventFieldOnTask(taskGid, labels, ctx.token);
  } catch (e) {
    const base = e instanceof Error ? e.message : "이벤트 구분 필드 설정 실패";
    ctx.eventFieldErrors.push(taskName ? `[${taskName}] ${base}` : base);
  }
}

export async function createTasksFromPreview(
  request: AsanaCreateTasksRequest
): Promise<AsanaCreateTasksResponse> {
  validateToken(request.asanaToken);
  if (!isValidGid(request.projectGid)) throw new Error("Asana 프로젝트를 선택해주세요.");
  if (!request.sectionName?.trim()) throw new Error("섹션명을 입력해주세요.");

  const token = request.asanaToken;
  const isDerivative = !!request.derivative;

  // ── 파생 모드: 기존 섹션 GID 직접 사용, 신규 생성 생략 ────────────────────
  const [sectionGid, requesterGid] = await Promise.all([
    isDerivative
      ? Promise.resolve(request.derivative!.sectionGid)
      : getOrCreateSection(request.projectGid, request.sectionName.trim(), token),
    getCurrentUserGid(token).catch(() => "")
  ]);
  // 아티스트별 담당자 규칙 적용: 소속 아티스트명 매핑이 있으면 해당 designerGid 사용
  const artistName = request.plan.normalizedData.artistName || "";
  const artistRule = (request.artistDesignerMap || []).find(
    (r) => r.artistName && artistName.toLowerCase().includes(r.artistName.toLowerCase())
  );
  const resolvedDesignerGid =
    (artistRule && isValidGid(artistRule.designerGid))
      ? artistRule.designerGid
      : isValidGid(request.designerGid ?? "") ? (request.designerGid ?? "") : requesterGid;

  const followerGids = (request.followerGids || []).filter(isValidGid);
  const productRegFollowerGids = (request.productRegFollowerGids || []).filter(isValidGid);

  // ── 파생 모드: 행 타이틀에 접미사 적용 + 오픈 → SNS 오픈 ─────────────────
  let effectiveRows = request.rows;
  if (isDerivative && request.derivative) {
    const { suffix } = request.derivative;
    effectiveRows = request.rows.map((r) => {
      // [CODE] → [CODE_CN] or [CODE_NAEU]
      let t = r.title.replace(/^\[([^\]]+)\]/, (_, code) => `[${code}${suffix}]`);
      // 오픈 → SNS 오픈 (끝에 "오픈"이 있는 경우만)
      if (r.key === "open") t = t.replace(/(\])\s*오픈$/, "$1 SNS 오픈");
      if (r.key === "opendesign") t = t.replace(/(\])\s*오픈\s*디자인$/, "$1 SNS 오픈 디자인");
      return { ...r, title: t };
    });
  }
  const rowMap = new Map(effectiveRows.map((r) => [r.key, r]));

  // 섹션에 현재 첫 번째 태스크 GID를 미리 파악 — 태스크 생성 전에 조회해야 함.
  // 생성 후에 조회하면 새로 만든 태스크가 섹션에 자동 배치되어 anchor가 오염됨.
  const firstExistingGid = await getFirstTaskInSection(sectionGid, token);

  // ── 파생 모드: 이벤트 구분 "파생" 고정 ──────────────────────────────────
  const eventLabels: OpenEventLabel[] = isDerivative
    ? ["파생"]
    : request.plan.openContext.eventLabels;

  const context: TaskCreateContext = {
    request,
    sectionGid,
    rowMap,
    createdTasks: [],
    token,
    projectGid: request.projectGid,
    requesterGid,
    designerGid: resolvedDesignerGid,
    topLevelTaskGids: [],
    eventLabels,
    followerGids,
    productRegFollowerGids,
    eventFieldErrors: [],
    isDerivative
  };

  // ── 생성 순서: 당첨자 선정 → VMD → MD → 업데이트 → 오픈 ──────────────────
  // 최종 표시 순서(역순): 오픈 (최상단) → 업데이트 → MD → VMD → 당첨자 선정
  // 파생 모드: winner/update 생성 생략
  if (!isDerivative && isEnabled(rowMap, "winner")) await createWinnerTask(context);
  if (isEnabled(rowMap, "vmd")) await createVmdTask(context);
  if (isEnabled(rowMap, "md")) await createMdTasks(context);
  if (!isDerivative && isEnabled(rowMap, "up")) await createUpdateTasks(context);
  if (isEnabled(rowMap, "open")) await createOpenTasks(context);

  // ── 섹션 최상단에 역순 배치 ───────────────────────────────────────────────
  // 각 태스크를 동일한 anchor(firstExisting) 바로 앞에 순서대로 삽입.
  // 나중에 삽입할수록 anchor 앞을 차지 → 마지막 생성(오픈)이 최상단.
  const anchor = firstExistingGid ?? undefined;
  for (let i = 0; i < context.topLevelTaskGids.length; i++) {
    await addTaskToSection(context.topLevelTaskGids[i], sectionGid, token, anchor);
  }

  // 이벤트 구분 필드 설정 실패가 있었으면 에러로 던짐 (태스크는 이미 생성됨)
  if (context.eventFieldErrors.length > 0) {
    throw new Error(
      `태스크는 생성됐지만 이벤트 구분 필드 설정에 실패했습니다: ${context.eventFieldErrors[0]}`
    );
  }

  return {
    projectGid: request.projectGid,
    projectUrl: `https://app.asana.com/0/${request.projectGid}`,
    sectionGid,
    createdTasks: context.createdTasks
  };
}

async function createMdTasks(ctx: TaskCreateContext): Promise<void> {
  const { request, rowMap, token, projectGid, requesterGid, designerGid, followerGids } = ctx;
  const { summary } = request.plan;
  const dueFields = getTaskDueFields(request.plan.normalizedData, "md");
  const mdName = title(rowMap, "md", `[${summary.productCode}] MD`);
  const pcName = title(rowMap, "pc", `[${summary.productCode}] 포토카드 / ${summary.photocards.length}세트 총 ${summary.photocardTotal}종`);
  const spName = title(rowMap, "sp", `[${summary.productCode}] 특전 / ${summary.benefits.length}종 총 ${summary.benefitTotal}종`);

  // ── MD 부모: 상태(진행) + 태스크 구분 ───────────────────────────────────
  const mdPayload: AsanaTaskPayload = {
    name: mdName,
    projects: [projectGid],
    assignee: requesterGid || undefined,
    notes: '발주 후 "완료" 처리 부탁드립니다!',
    custom_fields: await buildBaseProgressFields(projectGid, TASK_TYPE_NAME_MD, token)
  };
  applyDue(mdPayload, dueFields);
  applyFollowers(mdPayload, followerGids);
  const mdGid = await createTask(mdPayload, token);
  ctx.topLevelTaskGids.push(mdGid);
  record(ctx, "md", mdGid, mdName);

  // ── 포토카드 서브: 태스크 구분 ──────────────────────────────────────────
  if (summary.photocards.length > 0 && isEnabled(rowMap, "pc")) {
    const pcPayload: AsanaTaskPayload = {
      name: pcName,
      parent: mdGid,
      assignee: designerGid || undefined,
      html_notes: buildPhotocardDescription(summary.photocards),
      custom_fields: await buildTaskTypeOnlyFields(projectGid, TASK_TYPE_NAME_PC, token)
    };
    applyDue(pcPayload, dueFields);
    applyFollowers(pcPayload, followerGids);
    const pcGid = await createTask(pcPayload, token);
    record(ctx, "pc", pcGid, pcName);
  }

  // ── 특전 서브: 태스크 구분 ───────────────────────────────────────────────
  if (isEnabled(rowMap, "sp")) {
    const spPayload: AsanaTaskPayload = {
      name: spName,
      parent: mdGid,
      assignee: designerGid || undefined,
      html_notes: buildBenefitDescription(summary.benefits),
      custom_fields: await buildTaskTypeOnlyFields(projectGid, TASK_TYPE_NAME_MD, token)
    };
    applyDue(spPayload, dueFields);
    applyFollowers(spPayload, followerGids);
    const spGid = await createTask(spPayload, token);
    record(ctx, "sp", spGid, spName);
  }
}

async function createUpdateTasks(ctx: TaskCreateContext): Promise<void> {
  const { request, rowMap, token, projectGid, requesterGid, designerGid, followerGids } = ctx;
  const { summary } = request.plan;
  const dueFields = getTaskDueFields(request.plan.normalizedData, "update");
  const upName = title(rowMap, "up", `[${summary.productCode}] 업데이트`);
  const upSubName = title(rowMap, "upsub", `[${summary.productCode}] 업데이트 / ${summary.photocards.length + summary.benefits.length}종`);

  // ── 업데이트 부모: 상태(진행) + 태스크 구분 ─────────────────────────────
  const upPayload: AsanaTaskPayload = {
    name: upName,
    projects: [projectGid],
    assignee: requesterGid || undefined,
    notes: 'SNS 발행 후 "완료" 처리 부탁드립니다!',
    custom_fields: await buildBaseProgressFields(projectGid, TASK_TYPE_NAME_UPDATE, token)
  };
  applyDue(upPayload, dueFields);
  applyFollowers(upPayload, followerGids);
  const upGid = await createTask(upPayload, token);
  ctx.topLevelTaskGids.push(upGid);
  record(ctx, "up", upGid, upName);

  // ── 업데이트 서브: 상태(진행) + 태스크 구분 (부모와 동일 처리) ──────────
  if (isEnabled(rowMap, "upsub")) {
    const subPayload: AsanaTaskPayload = {
      name: upSubName,
      parent: upGid,
      assignee: designerGid || undefined,
      html_notes: buildUpdateDescription(summary.photocards, summary.benefits),
      custom_fields: await buildBaseProgressFields(projectGid, TASK_TYPE_NAME_UPDATE, token)
    };
    applyDue(subPayload, dueFields);
    applyFollowers(subPayload, followerGids);
    const subGid = await createTask(subPayload, token);
    record(ctx, "upsub", subGid, upSubName);
  }
}

async function createOpenTasks(ctx: TaskCreateContext): Promise<void> {
  const { request, rowMap, token, projectGid, requesterGid, designerGid, eventLabels, followerGids, productRegFollowerGids, isDerivative } = ctx;
  const { summary, openContext } = request.plan;
  const dueFields = getTaskDueFields(request.plan.normalizedData, "open");

  const openName = title(rowMap, "open", isDerivative
    ? `[${summary.productCode}] SNS 오픈`
    : `[${summary.productCode}] 오픈`);
  const designName = title(rowMap, "opendesign", isDerivative
    ? `[${summary.productCode}] SNS 오픈 디자인`
    : `[${summary.productCode}] 오픈 디자인`);

  // ── 오픈 부모: 상태(진행) + 태스크 구분 + 이벤트 구분 ───────────────────
  const openPayload: AsanaTaskPayload = {
    name: openName,
    projects: [projectGid],
    assignee: requesterGid || undefined,
    ...(isDerivative
      ? {
          html_notes:
            "<body>메이크스타에서 오픈한 이벤트를 특정 국가를 타겟으로 추가 작업할 때 사용하는 태스크 입니다!" +
            `<ul><li>SNS 발행 후 &#x201C;완료&#x201D; 처리 부탁드립니다!</li>` +
            `<li>&#x201C;이벤트 구분&#x201D; 필드 값을 입력해 주세요! <em>(중복 선택 가능)</em></li></ul></body>`
        }
      : { notes: '페이지 작업 후 "완료" 처리 부탁드립니다!' }),
    custom_fields: await buildBaseProgressFields(projectGid, TASK_TYPE_NAME_OPEN, token)
  };
  applyDue(openPayload, dueFields);
  applyFollowers(openPayload, followerGids);
  const openGid = await createTask(openPayload, token);
  await safeSetEventField(openGid, eventLabels, ctx);
  ctx.topLevelTaskGids.push(openGid);
  record(ctx, "open", openGid, openName);

  // ── 오픈 디자인 서브: 태스크 구분 + 이벤트 구분 ─────────────────────────
  // followerGids 미적용: 담당자(designerGid)가 이미 assignee이므로 중복 추가 불필요
  if (isEnabled(rowMap, "opendesign")) {
    const designPayload: AsanaTaskPayload = {
      name: designName,
      parent: openGid,
      assignee: designerGid || undefined,
      html_notes: isDerivative
        ? buildSnsOpenDescription(openContext)
        : buildOpenDescription(openContext),
      custom_fields: await buildTaskTypeOnlyFields(projectGid, TASK_TYPE_NAME_OPEN, token)
    };
    applyDue(designPayload, dueFields);
    const designGid = await createTask(designPayload, token);
    await safeSetEventField(designGid, eventLabels, ctx);
    record(ctx, "opendesign", designGid, designName);
  }

  // ── 상품 등록 관련 서브태스크 (SNS 오픈=파생 모드 제외) ─────────────────
  if (!isDerivative) {
    const isYdn = openContext.isYdn;
    // 상품 등록 태스크 전용 follower = 전체 follower + 상품 등록 전담 follower 합산
    const regFollowers = [...new Set([...followerGids, ...productRegFollowerGids])];

    // 시트 언어 검수 (메이크스타 전용, YDN 제외)
    if (!isYdn && isEnabled(rowMap, "sitelang")) {
      const siteLangName = title(rowMap, "sitelang", `[${summary.productCode}] 시트 언어 검수`);
      const siteLangPayload: AsanaTaskPayload = {
        name: siteLangName,
        parent: openGid,
        html_notes: buildSiteLangDescription()
        // 태스크 구분 없음 (상품 등록 workflow 담당자가 처리)
      };
      applyDue(siteLangPayload, dueFields);   // 오픈 마감일과 동일
      applyFollowers(siteLangPayload, regFollowers);
      const siteLangGid = await createTask(siteLangPayload, token);
      record(ctx, "sitelang", siteLangGid, siteLangName);

      // 언어별 하위 태스크 (자동 생성, 별도 체크박스 없음)
      const langSubTasks = [
        `[${summary.productCode}] 영어 시트 검수`,
        `[${summary.productCode}] 중국어(간체) 시트 검수`,
        `[${summary.productCode}] 일본어 시트 검수`
      ];
      for (const langName of langSubTasks) {
        const langPayload: AsanaTaskPayload = {
          name: langName,
          parent: siteLangGid
        };
        applyFollowers(langPayload, regFollowers);
        await createTask(langPayload, token);
      }
    }

    // 어드민 상품 등록 (플랫폼에 따라 내용 분기)
    if (isEnabled(rowMap, "adminreg")) {
      const adminRegName = title(
        rowMap, "adminreg",
        isYdn
          ? `[${summary.productCode}] 웨이디엔 어드민 상품 등록 및 검수`
          : `[${summary.productCode}] 어드민 상품 등록`
      );
      const adminRegPayload: AsanaTaskPayload = {
        name: adminRegName,
        parent: openGid,
        html_notes: isYdn ? buildYdnAdminRegDescription() : buildAdminRegDescription(),
        custom_fields: await buildTaskTypeOnlyFields(projectGid, TASK_TYPE_NAME_OPEN, token)
      };
      applyDue(adminRegPayload, dueFields);   // 오픈 마감일과 동일
      applyFollowers(adminRegPayload, regFollowers);
      const adminRegGid = await createTask(adminRegPayload, token);
      record(ctx, "adminreg", adminRegGid, adminRegName);
    }
  }
}

async function createVmdTask(ctx: TaskCreateContext): Promise<void> {
  const { request, rowMap, token, projectGid, requesterGid, designerGid, followerGids } = ctx;
  const { summary, openContext } = request.plan;
  const dueFields = getTaskDueFields(request.plan.normalizedData, "vmd");
  const vmdName = title(rowMap, "vmd", `[${summary.productCode}] VMD`);
  const subName = title(rowMap, "vmdsub", resolveVmdSubName(summary.productCode, openContext.venue, openContext.vmdItemCount));

  // ── VMD 부모: 상태(진행) + 태스크 구분 ──────────────────────────────────
  const vmdPayload: AsanaTaskPayload = {
    name: vmdName,
    projects: [projectGid],
    assignee: requesterGid || undefined,
    notes: '발주 후 "완료" 처리 부탁드립니다!',
    custom_fields: await buildBaseProgressFields(projectGid, TASK_TYPE_NAME_VMD, token)
  };
  applyDue(vmdPayload, dueFields);
  applyFollowers(vmdPayload, followerGids);
  const vmdGid = await createTask(vmdPayload, token);
  ctx.topLevelTaskGids.push(vmdGid);
  record(ctx, "vmd", vmdGid, vmdName);

  // ── VMD 서브: 태스크 구분 ────────────────────────────────────────────────
  if (isEnabled(rowMap, "vmdsub")) {
    const subPayload: AsanaTaskPayload = {
      name: subName,
      parent: vmdGid,
      assignee: designerGid || undefined,
      html_notes: buildVmdDescription(openContext),
      custom_fields: await buildTaskTypeOnlyFields(projectGid, TASK_TYPE_NAME_VMD, token)
    };
    applyDue(subPayload, dueFields);
    applyFollowers(subPayload, followerGids);
    const subGid = await createTask(subPayload, token);
    record(ctx, "vmdsub", subGid, subName);
  }
}

async function createWinnerTask(ctx: TaskCreateContext): Promise<void> {
  const { request, rowMap, token, projectGid, requesterGid, followerGids } = ctx;
  const { summary } = request.plan;
  const dueFields = getWinnerDueFields(request.plan.normalizedData);
  const winnerName = title(rowMap, "winner", `[${summary.productCode}] 당첨자 선정`);

  // ── 당첨자 선정: 상태(진행) + 태스크 구분(기타) ─────────────────────────
  // followerGids 미적용: 스케줄링 목적 태스크이므로 협업 참여자 불필요
  const payload: AsanaTaskPayload = {
    name: winnerName,
    projects: [projectGid],
    assignee: requesterGid || undefined,
    notes: "당첨자 관련 업무 스케줄링을 위한 태스크입니다!",
    custom_fields: await buildBaseProgressFields(projectGid, TASK_TYPE_NAME_ETC, token)
  };
  applyDue(payload, dueFields);
  const gid = await createTask(payload, token);
  ctx.topLevelTaskGids.push(gid);
  record(ctx, "winner", gid, winnerName);
}

async function createTask(payload: AsanaTaskPayload, token: string): Promise<string> {
  try {
    const task = await asanaRequest<{ gid: string }>("post", "/tasks", token, payload);
    return task.gid;
  } catch (err) {
    // 커스텀 필드가 해당 프로젝트에 없을 때 → 필드 없이 재시도
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Custom field") && msg.includes("not on given object") && payload.custom_fields) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[createTask] 커스텀 필드 미설정, 필드 제외 후 재시도:", msg);
      }
      const { custom_fields: _cf, ...rest } = payload;
      const task = await asanaRequest<{ gid: string }>("post", "/tasks", token, rest);
      return task.gid;
    }
    throw err;
  }
}

/** 협업 참여자가 있으면 payload에 followers 추가 */
function applyFollowers(payload: AsanaTaskPayload, gids: string[]): void {
  if (gids.length > 0) payload.followers = gids;
}

function applyDue(payload: AsanaTaskPayload, due: DueFields): void {
  delete payload.due_on;
  delete payload.due_at;
  if (due.due_at) { payload.due_at = due.due_at; return; }
  if (due.due_on) payload.due_on = due.due_on;
}

function title(rowMap: Map<TaskKey, PreviewTaskRow>, key: TaskKey, fallback: string): string {
  return rowMap.get(key)?.title?.trim() || fallback;
}

function isEnabled(rowMap: Map<TaskKey, PreviewTaskRow>, key: TaskKey): boolean {
  const row = rowMap.get(key);
  if (!row || !row.available || !row.enabled) return false;
  if (row.parentKey) return isEnabled(rowMap, row.parentKey);
  return true;
}

function record(ctx: TaskCreateContext, key: string, gid: string, name: string): void {
  ctx.createdTasks.push({
    key,
    gid,
    name,
    url: `https://app.asana.com/0/${ctx.projectGid}/${gid}`
  });
}

