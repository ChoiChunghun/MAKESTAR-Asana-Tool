import { PLUGIN_DATA_KEY, type MappingData } from "./types";
import { errorMessage } from "./logger";

export function readNodeMapping(node: BaseNode): { ok: true; mapping?: MappingData } | { ok: false; error: string } {
  try {
    const raw = node.getPluginData(PLUGIN_DATA_KEY);
    if (!raw) {
      return { ok: true };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { ok: false, error: `Invalid pluginData JSON: ${errorMessage(error)}` };
    }

    if (!isMappingData(parsed)) {
      return { ok: false, error: "pluginData does not match MappingData shape." };
    }

    return { ok: true, mapping: parsed };
  } catch (error) {
    return { ok: false, error: `Failed to read pluginData: ${errorMessage(error)}` };
  }
}

export function writeNodeMapping(node: BaseNode, mapping: MappingData): { ok: true } | { ok: false; error: string } {
  try {
    node.setPluginData(PLUGIN_DATA_KEY, JSON.stringify(mapping));
    node.setRelaunchData({ open: "Open PDF Sync" });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Failed to write pluginData: ${errorMessage(error)}` };
  }
}

function isMappingData(value: unknown): value is MappingData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const mapping = value as Partial<MappingData>;
  return (
    typeof mapping.sourcePdfId === "string" &&
    mapping.sourcePdfId.length > 0 &&
    typeof mapping.pageNumber === "number" &&
    Number.isInteger(mapping.pageNumber) &&
    mapping.pageNumber > 0 &&
    typeof mapping.syncEnabled === "boolean"
  );
}
