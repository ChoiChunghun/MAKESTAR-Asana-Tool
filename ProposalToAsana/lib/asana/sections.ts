import { isValidGid } from "@/lib/parser/utils";
import { asanaRequest } from "./client";

type AsanaSection = {
  gid: string;
  name: string;
};

export async function getOrCreateSection(projectGid: string, name: string): Promise<string> {
  const sections = await asanaRequest<AsanaSection[]>("get", `/projects/${projectGid}/sections`);
  const existing = sections.find((section) => section.name === name);
  if (existing) {
    await moveSectionToTop(projectGid, existing.gid, sections);
    return existing.gid;
  }

  const created = await asanaRequest<AsanaSection>("post", `/projects/${projectGid}/sections`, { name });
  await moveSectionToTop(projectGid, created.gid, sections);
  return created.gid;
}

export async function addTaskToSection(taskGid: string, sectionGid: string): Promise<void> {
  await asanaRequest("post", `/sections/${sectionGid}/addTask`, { task: taskGid });
}

async function moveSectionToTop(projectGid: string, sectionGid: string, sections?: AsanaSection[]): Promise<void> {
  if (!isValidGid(projectGid) || !isValidGid(sectionGid)) return;

  const sectionList = sections || (await asanaRequest<AsanaSection[]>("get", `/projects/${projectGid}/sections`));
  let firstOtherSectionGid = "";

  for (const section of sectionList) {
    const currentGid = String(section?.gid || "");
    if (!isValidGid(currentGid)) continue;
    if (currentGid === String(sectionGid)) {
      if (!firstOtherSectionGid) return;
      break;
    }
    if (!firstOtherSectionGid) firstOtherSectionGid = currentGid;
  }

  if (!isValidGid(firstOtherSectionGid)) return;

  await asanaRequest("post", `/projects/${projectGid}/sections/insert`, {
    section: sectionGid,
    before_section: firstOtherSectionGid
  });
}
