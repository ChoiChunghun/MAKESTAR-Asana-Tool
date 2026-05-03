import type { DesignOutput, OutputType } from "../shared/types";

const FALLBACK_TEXT_MAP: Partial<Record<OutputType, Record<string, string[]>>> = {
  SNS_X_OPEN_01: {
    artistAlbumTitle: ["ARTIST NAME + ALBUM NAME + (POCAALBUM)"],
    eventTitle: ["EVENT NAME EVENT NAME"],
    periodText: ["YYYY.MM.DD HH:MM - YYYY.MM.DD HH:MM KST"],
    siteText: ["SITE / CHANNEL"]
  }
};

export async function setTextNodeCharacters(node: TextNode, value: string): Promise<void> {
  if (node.fontName === figma.mixed) {
    const fonts = new Set<string>();
    for (let index = 0; index < node.characters.length; index += 1) {
      const font = node.getRangeFontName(index, index + 1);
      if (font !== figma.mixed) {
        fonts.add(JSON.stringify(font));
      }
    }

    await Promise.all([...fonts].map((font) => figma.loadFontAsync(JSON.parse(font))));
  } else {
    await figma.loadFontAsync(node.fontName as FontName);
  }

  node.characters = value;
}

function walkScene(root: SceneNode, visit: (node: SceneNode) => void): void {
  visit(root);
  if ("children" in root) {
    for (const child of root.children) {
      walkScene(child as SceneNode, visit);
    }
  }
}

function findTextNodeByName(root: SceneNode, targetNames: string[]): TextNode | null {
  let result: TextNode | null = null;
  const normalizedNames = targetNames.map((name) => name.trim());

  walkScene(root, (node) => {
    if (result || node.type !== "TEXT") {
      return;
    }
    if (normalizedNames.includes(node.name.trim())) {
      result = node;
    }
  });

  return result;
}

export function findTextNodeByCharacters(root: SceneNode, target: string): TextNode | null {
  let result: TextNode | null = null;

  walkScene(root, (node) => {
    if (result || node.type !== "TEXT") {
      return;
    }
    if (node.characters.trim() === target.trim()) {
      result = node;
    }
  });

  return result;
}

export async function applyTextBindings(root: SceneNode, output: DesignOutput): Promise<string[]> {
  const warnings: string[] = [];
  const fallbackMap = FALLBACK_TEXT_MAP[output.outputType] ?? {};

  for (const [bindingKey, value] of Object.entries(output.textBindings)) {
    const byName = findTextNodeByName(root, [`{{${bindingKey}}}`, bindingKey]);
    const fallbackTargets = fallbackMap[bindingKey] ?? [];
    const byFallback = fallbackTargets.map((target) => findTextNodeByCharacters(root, target)).find(Boolean) ?? null;
    const targetNode = byName || byFallback;

    if (!targetNode) {
      warnings.push(`Text target not found: ${bindingKey}`);
      continue;
    }

    await setTextNodeCharacters(targetNode, value);
  }

  return warnings;
}

