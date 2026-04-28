import type { AsanaProject } from "@/types/asana";
import { TESTFARM_GID } from "@/lib/parser/constants";
import { isValidGid } from "@/lib/parser/utils";
import { asanaRequest, getDefaultProjectGid } from "./client";

type AsanaProjectInfo = {
  gid: string;
  name: string;
  workspace?: {
    gid?: string;
    name?: string;
  };
};

export async function getProjectInfo(projectGid: string): Promise<AsanaProjectInfo> {
  if (!isValidGid(projectGid)) return {} as AsanaProjectInfo;
  return asanaRequest<AsanaProjectInfo>( "get", `/projects/${projectGid}?opt_fields=name,workspace.gid,workspace.name`);
}

export async function getProjectName(projectGid: string): Promise<string> {
  const project = await getProjectInfo(projectGid);
  return project?.name ? String(project.name) : "";
}

export async function getProjectLabel(projectGid: string): Promise<string> {
  return (await getProjectName(projectGid)) || String(projectGid || "");
}

export async function getAvailableProjectOptions(): Promise<AsanaProject[]> {
  const defaultProjectGid = getDefaultProjectGid();
  const fallbackName = (await getProjectName(defaultProjectGid).catch(() => "")) || "TESTFARM";
  const fallback = [{ gid: defaultProjectGid || TESTFARM_GID, name: fallbackName }];

  const projectInfo = await getProjectInfo(defaultProjectGid);
  const workspaceGid = projectInfo.workspace?.gid;
  if (!workspaceGid || !isValidGid(workspaceGid)) return fallback;

  const projects = await asanaRequest<AsanaProject[]>(
    "get",
    `/workspaces/${workspaceGid}/projects?archived=false&limit=100&opt_fields=name`
  );
  const seen = new Set<string>();
  const options = projects
    .filter((project) => isValidGid(project.gid) && Boolean(project.name))
    .filter((project) => {
      if (seen.has(project.gid)) return false;
      seen.add(project.gid);
      return true;
    })
    .map((project) => ({ gid: String(project.gid), name: String(project.name) }));

  if (!seen.has(defaultProjectGid)) {
    options.unshift({ gid: defaultProjectGid, name: fallbackName });
  }

  options.sort((a, b) => {
    if (a.gid === defaultProjectGid) return -1;
    if (b.gid === defaultProjectGid) return 1;
    return a.name.localeCompare(b.name, "ko");
  });

  return options.length > 0 ? options : fallback;
}
