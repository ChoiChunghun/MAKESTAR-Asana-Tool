import type { OutputType, TemplateLocator } from "../shared/types";

const TEMPLATE_LOCATORS: Record<OutputType, TemplateLocator> = {
  BANNER: {
    outputType: "BANNER",
    sectionName: "STORY",
    templateLabel: "MAKESTAR-WEIDIAN / Banner",
    templateInstanceName: "Banner"
  },
  STORY: {
    outputType: "STORY",
    sectionName: "STORY",
    templateLabel: "MAKESTAR-WEIDIAN / Story",
    templateInstanceName: "Story"
  },
  SNS_X_OPEN_01: {
    outputType: "SNS_X_OPEN_01",
    sectionName: "X",
    templateLabel: "Template SNS / X / OPEN / 01",
    templateInstanceName: "OPEN / 01"
  },
  SNS_X_OPEN_02: {
    outputType: "SNS_X_OPEN_02",
    sectionName: "X",
    templateLabel: "Template SNS / X / OPEN / 02",
    templateInstanceName: "OPEN / 02"
  },
  SNS_X_OPEN_03: {
    outputType: "SNS_X_OPEN_03",
    sectionName: "X",
    templateLabel: "Template SNS / X / OPEN / 03",
    templateInstanceName: "OPEN / 03"
  },
  SNS_X_UPDATE: {
    outputType: "SNS_X_UPDATE",
    sectionName: "X",
    templateLabel: "Template SNS / X / UPDATE",
    templateInstanceName: "UPDATE"
  }
};

type AnyNode = BaseNode & Partial<ChildrenMixin>;

export function getTemplateLocator(outputType: OutputType): TemplateLocator {
  return TEMPLATE_LOCATORS[outputType];
}

export function findInstanceByName(root: AnyNode, instanceName: string): InstanceNode | null {
  let result: InstanceNode | null = null;

  function walk(node: AnyNode): void {
    if (result) {
      return;
    }

    if (node.type === "INSTANCE" && node.name === instanceName) {
      result = node;
      return;
    }

    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child as AnyNode);
      }
    }
  }

  walk(root);
  return result;
}

function findNodeByTemplateLabel(root: AnyNode, templateLabel: string): BaseNode | null {
  let result: BaseNode | null = null;

  function walk(node: AnyNode): void {
    if (result) {
      return;
    }

    if (node.name === templateLabel) {
      result = node;
      return;
    }

    if (node.type === "TEXT" && node.characters.trim() === templateLabel) {
      result = node;
      return;
    }

    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child as AnyNode);
      }
    }
  }

  walk(root);
  return result;
}

function findSectionRoot(sectionName: string): BaseNode | null {
  let result: BaseNode | null = null;

  function walk(node: AnyNode): void {
    if (result) {
      return;
    }

    if ((node.type === "SECTION" || node.type === "FRAME") && node.name === sectionName) {
      result = node;
      return;
    }

    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child as AnyNode);
      }
    }
  }

  walk(figma.root as AnyNode);
  return result;
}

function ancestorCandidates(node: BaseNode | null): BaseNode[] {
  const ancestors: BaseNode[] = [];
  let current: BaseNode | null = node;
  let depth = 0;

  while (current && depth < 4) {
    ancestors.push(current);
    current = current.parent;
    depth += 1;
  }

  return ancestors;
}

export function findTemplateInstance(outputType: OutputType): InstanceNode {
  const locator = getTemplateLocator(outputType);
  const sectionRoot = findSectionRoot(locator.sectionName);
  if (!sectionRoot) {
    throw new Error(
      `템플릿을 찾지 못했습니다.\nFigma 파일에서 다음 템플릿 인스턴스가 존재하는지 확인해 주세요:\n${locator.templateInstanceName}`
    );
  }

  const labelNode = findNodeByTemplateLabel(sectionRoot as AnyNode, locator.templateLabel);
  if (labelNode) {
    for (const candidate of ancestorCandidates(labelNode)) {
      const instance = findInstanceByName(candidate as AnyNode, locator.templateInstanceName);
      if (instance) {
        return instance;
      }
    }
  }

  const fallback = findInstanceByName(sectionRoot as AnyNode, locator.templateInstanceName);
  if (fallback) {
    return fallback;
  }

  throw new Error(
    `템플릿을 찾지 못했습니다.\nFigma 파일에서 다음 템플릿 인스턴스가 존재하는지 확인해 주세요:\n${locator.templateInstanceName}`
  );
}

