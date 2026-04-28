import { applyImageFill } from "./shared/imageFill";
import { errorMessage, writeConsoleLog } from "./shared/logger";
import { buildManifestUrl, fetchManifest, resolvePageImageUrl } from "./shared/manifestClient";
import { readNodeMapping, writeNodeMapping } from "./shared/pluginData";
import { isSupportedImageNode, readCurrentSelection } from "./shared/selection";
import { TEST_IMAGE_URL, type LogLevel, type OperationIssue, type OperationResult, type PluginToUiMessage, type UiToPluginMessage } from "./shared/types";

declare const __html__: string;

console.log("[boot] plugin start");

let uiReady = false;

try {
  figma.showUI(__html__, { width: 420, height: 640 });
  console.log("[boot] showUI called");

  figma.ui.onmessage = (message: UiToPluginMessage) => {
    void handleUiMessage(message);
  };
} catch (error) {
  console.error("[error] boot failed", error);
  try {
    figma.notify(`PDF Page Sync boot failed: ${errorMessage(error)}`, { error: true });
  } catch {
    // There is nowhere safer to report if notify also fails.
  }
}

async function handleUiMessage(message: UiToPluginMessage): Promise<void> {
  try {
    switch (message.type) {
      case "ui-ready":
        uiReady = true;
        postLog("[boot] plugin start");
        postLog("[boot] showUI called");
        sendBootState();
        safeSendSelection();
        break;
      case "request-selection":
        safeSendSelection();
        break;
      case "connect":
        postResult(connectSelectedNodes(message.sourcePdfId, message.pageNumber));
        safeSendSelection();
        break;
      case "read-mapping":
        postResult(readMappingsForSelection());
        break;
      case "test-sync":
        postResult(await syncSelectedWithTestImage());
        safeSendSelection();
        break;
      case "real-sync":
        postResult(await syncSelectedFromManifest(message.manifestInput));
        safeSendSelection();
        break;
      default:
        postResult({
          ok: false,
          action: "unknown",
          message: "Unknown UI message.",
          issues: [{ level: "error", message: "Unknown UI message received." }]
        });
    }
  } catch (error) {
    const messageText = `[error] handler failed: ${errorMessage(error)}`;
    postLog(messageText, "error", error);
    postResult({
      ok: false,
      action: "handler",
      message: messageText,
      issues: [{ level: "error", message: messageText }]
    });
  }
}

function sendBootState(): void {
  try {
    postToUi({
      type: "boot-state",
      bootStatus: "booted",
      selection: readCurrentSelection()
    });
  } catch (error) {
    postLog(`[error] boot-state failed: ${errorMessage(error)}`, "error", error);
  }
}

function safeSendSelection(): void {
  try {
    postToUi({
      type: "selection-state",
      selection: readCurrentSelection()
    });
  } catch (error) {
    postLog(`[error] selection post failed: ${errorMessage(error)}`, "error", error);
  }
}

function connectSelectedNodes(sourcePdfIdInput: string, pageNumberInput: number): OperationResult {
  const sourcePdfId = sourcePdfIdInput.trim();
  const pageNumber = Number(pageNumberInput);
  const selection = readCurrentSelection();
  const issues: OperationIssue[] = [];

  if (!sourcePdfId) {
    return result(false, "connect", "Enter a sourcePdfId.", selection, [{ level: "error", message: "sourcePdfId is required." }]);
  }

  if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
    return result(false, "connect", "Enter a positive pageNumber.", selection, [{ level: "error", message: "pageNumber must be a positive integer." }]);
  }

  if (figma.currentPage.selection.length === 0) {
    return result(false, "connect", "Select Rectangle or Frame nodes first.", selection, [{ level: "warn", message: "No nodes selected." }]);
  }

  let savedCount = 0;
  for (const node of figma.currentPage.selection) {
    if (!isSupportedImageNode(node)) {
      issues.push(nodeIssue(node, "warn", `Skipped unsupported node type: ${node.type}.`));
      continue;
    }

    const writeResult = writeNodeMapping(node, {
      sourcePdfId,
      pageNumber,
      syncEnabled: true
    });

    if (writeResult.ok) {
      savedCount += 1;
      postLog(`[connect] mapping saved: ${node.name} -> ${sourcePdfId} page ${pageNumber}`);
    } else {
      issues.push(nodeIssue(node, "error", writeResult.error));
      postLog(`[error] ${node.name}: ${writeResult.error}`, "error");
    }
  }

  const ok = savedCount > 0 && !issues.some((issue) => issue.level === "error");
  return result(ok, "connect", `Saved mapping on ${savedCount} node(s).`, readCurrentSelection(), issues);
}

function readMappingsForSelection(): OperationResult {
  const selection = readCurrentSelection();
  const issues: OperationIssue[] = [];

  if (selection.count === 0) {
    issues.push({ level: "warn", message: "No selection. Select Rectangle or Frame nodes to inspect mappings." });
  }

  for (const node of selection.nodes) {
    if (!node.supported) {
      issues.push({ nodeId: node.id, nodeName: node.name, level: "warn", message: `Unsupported node type: ${node.type}.` });
    } else if (node.mappingError) {
      issues.push({ nodeId: node.id, nodeName: node.name, level: "error", message: node.mappingError });
    } else if (!node.mapping) {
      issues.push({ nodeId: node.id, nodeName: node.name, level: "info", message: "No mapping stored." });
    } else {
      issues.push({ nodeId: node.id, nodeName: node.name, level: "info", message: `${node.mapping.sourcePdfId} page ${node.mapping.pageNumber}` });
    }
  }

  return result(true, "read-mapping", "Current mapping read complete.", selection, issues);
}

async function syncSelectedWithTestImage(): Promise<OperationResult> {
  postLog("[sync:test] start");
  const selection = readCurrentSelection();
  const issues: OperationIssue[] = [];

  if (figma.currentPage.selection.length === 0) {
    return result(false, "test-sync", "Select Rectangle or Frame nodes first.", selection, [{ level: "warn", message: "No nodes selected." }]);
  }

  let appliedCount = 0;
  for (const node of figma.currentPage.selection) {
    if (!isSupportedImageNode(node)) {
      issues.push(nodeIssue(node, "warn", `Skipped unsupported node type: ${node.type}.`));
      continue;
    }

    const fillResult = await applyImageFill(node, TEST_IMAGE_URL);
    if (fillResult.ok) {
      appliedCount += 1;
      postLog(`[sync:test] success: ${node.name}`);
    } else {
      issues.push(nodeIssue(node, "error", fillResult.error));
      postLog(`[error] test sync failed on ${node.name}: ${fillResult.error}`, "error");
    }
  }

  return result(appliedCount > 0 && !issues.some((issue) => issue.level === "error"), "test-sync", `Applied test image to ${appliedCount} node(s).`, readCurrentSelection(), issues);
}

async function syncSelectedFromManifest(manifestInput: string): Promise<OperationResult> {
  const selection = readCurrentSelection();
  const issues: OperationIssue[] = [];

  if (figma.currentPage.selection.length === 0) {
    return result(false, "real-sync", "Select mapped Rectangle or Frame nodes first.", selection, [{ level: "warn", message: "No nodes selected." }]);
  }

  const manifestCache = new Map<string, Awaited<ReturnType<typeof fetchManifest>>>();
  let appliedCount = 0;

  for (const node of figma.currentPage.selection) {
    if (!isSupportedImageNode(node)) {
      issues.push(nodeIssue(node, "warn", `Skipped unsupported node type: ${node.type}.`));
      continue;
    }

    const mappingResult = readNodeMapping(node);
    if (!mappingResult.ok) {
      issues.push(nodeIssue(node, "error", mappingResult.error));
      continue;
    }

    if (!mappingResult.mapping) {
      issues.push(nodeIssue(node, "warn", "No mapping stored. Run Connect first."));
      continue;
    }

    if (!mappingResult.mapping.syncEnabled) {
      issues.push(nodeIssue(node, "warn", "syncEnabled is false."));
      continue;
    }

    const mapping = mappingResult.mapping;
    const manifestUrl = buildManifestUrl(manifestInput, mapping.sourcePdfId);
    postLog(`[sync:real] fetching manifest: ${manifestUrl}`);

    let manifestResult = manifestCache.get(manifestUrl);
    if (!manifestResult) {
      manifestResult = await fetchManifest(manifestUrl);
      manifestCache.set(manifestUrl, manifestResult);
    }

    if (!manifestResult.ok) {
      issues.push(nodeIssue(node, "error", manifestResult.error));
      postLog(`[error] real sync manifest failed: ${manifestResult.error}`, "error");
      continue;
    }

    postLog(`[sync:real] manifest loaded: ${manifestResult.manifest.version || "no-version"}`);

    const pageUrlResult = resolvePageImageUrl(manifestResult.manifest, mapping.sourcePdfId, mapping.pageNumber);
    if (!pageUrlResult.ok) {
      issues.push(nodeIssue(node, "error", pageUrlResult.error));
      postLog(`[error] page url resolve failed on ${node.name}: ${pageUrlResult.error}`, "error");
      continue;
    }

    postLog(`[sync:real] page url resolved: page ${mapping.pageNumber}`);
    const fillResult = await applyImageFill(node, pageUrlResult.url);
    if (!fillResult.ok) {
      issues.push(nodeIssue(node, "error", fillResult.error));
      postLog(`[error] real sync fill failed on ${node.name}: ${fillResult.error}`, "error");
      continue;
    }

    appliedCount += 1;
    postLog(`[sync:real] image fill applied: ${node.name}`);
  }

  return result(appliedCount > 0 && !issues.some((issue) => issue.level === "error"), "real-sync", `Applied manifest images to ${appliedCount} node(s).`, readCurrentSelection(), issues);
}

function result(ok: boolean, action: string, message: string, selection: ReturnType<typeof readCurrentSelection>, issues: OperationIssue[]): OperationResult {
  return {
    ok,
    action,
    message,
    issues,
    selection
  };
}

function nodeIssue(node: SceneNode, level: LogLevel, message: string): OperationIssue {
  return {
    nodeId: node.id,
    nodeName: node.name,
    level,
    message
  };
}

function postResult(operationResult: OperationResult): void {
  postToUi({ type: "operation-result", result: operationResult });
}

function postLog(message: string, level: LogLevel = "info", details?: unknown): void {
  const entry = writeConsoleLog(message, level, details);
  postToUi({ type: "log", entry });
}

function postToUi(message: PluginToUiMessage): void {
  try {
    figma.ui.postMessage(message);
  } catch (error) {
    console.error("[error] postToUi failed", error);
  }
}
