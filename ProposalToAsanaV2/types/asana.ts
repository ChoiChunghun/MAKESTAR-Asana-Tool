import type { ParsedPlanResult, PreviewTaskRow } from "./parser";

export type AsanaProject = {
  gid: string;
  name: string;
};

export type AsanaCreateTasksRequest = {
  asanaToken: string;
  projectGid: string;
  sectionName: string;
  plan: ParsedPlanResult;
  rows: PreviewTaskRow[];
  designerGid?: string;
  followerGids?: string[];
  artistDesignerMap?: { artistName: string; designerGid: string }[];
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
