import type { ParsedPlanResult, PreviewTaskRow } from "./parser";

export type AsanaProject = {
  gid: string;
  name: string;
};

/** 파생 모드: 동일 섹션 재사용 + _CN/_NAEU 접미사 + "파생" 이벤트 구분 고정 */
export type DerivativeMode = {
  sectionGid: string;
  suffix: "_CN" | "_NAEU";
};

export type AsanaCreateTasksRequest = {
  asanaToken: string;
  projectGid: string;
  projectName?: string;
  sectionName: string;
  plan: ParsedPlanResult;
  rows: PreviewTaskRow[];
  designerGid?: string;
  followerGids?: string[];
  artistDesignerMap?: { artistName: string; designerGid: string }[];
  /** 설정 시 파생 모드로 동작 */
  derivative?: DerivativeMode;
};

export type CreatedAsanaTask = {
  key: string;
  gid: string;
  name: string;
  url: string;
};

export type AsanaCreateTasksResponse = {
  projectGid: string;
  projectUrl: string;
  sectionGid: string;
  createdTasks: CreatedAsanaTask[];
};
