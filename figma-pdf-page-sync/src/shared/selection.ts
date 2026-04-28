import { readNodeMapping } from "./pluginData";
import type { SelectionNodeInfo, SelectionSnapshot } from "./types";

export function isSupportedImageNode(node: SceneNode): node is RectangleNode | FrameNode {
  return node.type === "RECTANGLE" || node.type === "FRAME";
}

export function readCurrentSelection(): SelectionSnapshot {
  try {
    const selected = figma.currentPage.selection.slice();
    console.log(`[selection] selected count: ${selected.length}`);

    const nodes: SelectionNodeInfo[] = selected.map((node) => {
      const mappingResult = readNodeMapping(node);
      const base: SelectionNodeInfo = {
        id: node.id,
        name: node.name,
        type: node.type,
        supported: isSupportedImageNode(node)
      };

      if (!mappingResult.ok) {
        return { ...base, mappingError: mappingResult.error };
      }

      return { ...base, mapping: mappingResult.mapping };
    });

    const supportedCount = nodes.filter((node) => node.supported).length;
    return {
      ok: true,
      count: selected.length,
      supportedCount,
      skippedCount: selected.length - supportedCount,
      nodes
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[error] selection read failed", error);
    return {
      ok: false,
      count: 0,
      supportedCount: 0,
      skippedCount: 0,
      nodes: [],
      error: message
    };
  }
}
