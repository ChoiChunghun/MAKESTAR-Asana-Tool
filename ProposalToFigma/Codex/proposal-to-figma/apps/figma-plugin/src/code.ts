declare const __html__: string;

import { buildSpreadsheetUrl } from "./plugin/url";
import { generateOutputs } from "./plugin/generator";
import { readBinding } from "./plugin/bindingStorage";
import { applyOutputToSelection, readSelectedBinding } from "./plugin/sync";
import type {
  DiffDesignResponse,
  ParseSheetResponse,
  PluginToUiMessage,
  SelectionBindingSummary,
  UiToPluginMessage
} from "./shared/types";

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8787";

figma.showUI(__html__, {
  width: 460,
  height: 760,
  themeColors: true
});

async function getStoredBackendUrl(): Promise<string> {
  return (await figma.clientStorage.getAsync("backendBaseUrl")) || DEFAULT_BACKEND_URL;
}

async function setStoredBackendUrl(value: string): Promise<void> {
  await figma.clientStorage.setAsync("backendBaseUrl", value);
}

function postMessage(message: PluginToUiMessage): void {
  figma.ui.postMessage(message);
}

function getSelectionSummary(): SelectionBindingSummary {
  const [selectedNode] = figma.currentPage.selection;
  if (!selectedNode) {
    return {
      hasSelection: false,
      hasBinding: false
    };
  }

  const binding = readBinding(selectedNode);
  return {
    hasSelection: true,
    hasBinding: Boolean(binding),
    nodeName: selectedNode.name,
    outputId: binding?.outputId,
    outputType: binding?.outputType,
    sourceHash: binding?.sourceHash
  };
}

async function bootstrapUi(): Promise<void> {
  postMessage({
    type: "BOOTSTRAP",
    backendBaseUrl: await getStoredBackendUrl(),
    selection: getSelectionSummary()
  });
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error || "요청을 처리하지 못했습니다.");
  }

  return payload as T;
}

async function handleParseSheet(message: Extract<UiToPluginMessage, { type: "PARSE_SHEET" }>): Promise<void> {
  await setStoredBackendUrl(message.backendBaseUrl);
  const payload = await fetchJson<ParseSheetResponse>(`${message.backendBaseUrl}/api/parse-sheet`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(message.input)
  });

  postMessage({
    type: "PARSE_RESULT",
    payload
  });
  figma.notify("Proposal parsing completed.");
}

async function handleGenerateOutputs(
  message: Extract<UiToPluginMessage, { type: "GENERATE_OUTPUTS" }>
): Promise<void> {
  const created = await generateOutputs(message.designData, message.outputIds);
  postMessage({
    type: "GENERATE_RESULT",
    created
  });
  postMessage({
    type: "SELECTION_CHANGED",
    selection: getSelectionSummary()
  });
  figma.notify(`${created.length}개 산출물을 생성했습니다.`);
}

async function handleCheckUpdates(message: Extract<UiToPluginMessage, { type: "CHECK_UPDATES" }>): Promise<void> {
  await setStoredBackendUrl(message.backendBaseUrl);
  const { binding } = readSelectedBinding();
  if (!binding) {
    throw new Error("선택한 레이어에 proposalToFigmaBinding이 없습니다.");
  }

  const payload = await fetchJson<DiffDesignResponse>(`${message.backendBaseUrl}/api/designs/diff`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      spreadsheetUrl: buildSpreadsheetUrl(binding.sourceSpreadsheetId),
      sheetName: binding.sourceSheetName,
      range: binding.sourceRange,
      previousSourceHash: binding.sourceHash,
      outputId: binding.outputId
    })
  });

  postMessage({
    type: "SYNC_RESULT",
    payload
  });

  figma.notify(payload.hasChanges ? "변경 사항을 찾았습니다." : "변경 사항이 없습니다.");
}

async function handleApplyUpdates(message: Extract<UiToPluginMessage, { type: "APPLY_UPDATES" }>): Promise<void> {
  const node = await applyOutputToSelection(message.designData, message.output);
  postMessage({
    type: "APPLY_RESULT",
    nodeName: node.name,
    outputId: message.output.outputId
  });
  postMessage({
    type: "SELECTION_CHANGED",
    selection: getSelectionSummary()
  });
  figma.notify("선택한 산출물을 업데이트했습니다.");
}

figma.on("selectionchange", () => {
  postMessage({
    type: "SELECTION_CHANGED",
    selection: getSelectionSummary()
  });
});

figma.ui.onmessage = async (message: UiToPluginMessage) => {
  try {
    switch (message.type) {
      case "INIT":
        await bootstrapUi();
        break;
      case "SAVE_BACKEND_URL":
        await setStoredBackendUrl(message.backendBaseUrl);
        break;
      case "PARSE_SHEET":
        await handleParseSheet(message);
        break;
      case "GENERATE_OUTPUTS":
        await handleGenerateOutputs(message);
        break;
      case "CHECK_UPDATES":
        await handleCheckUpdates(message);
        break;
      case "APPLY_UPDATES":
        await handleApplyUpdates(message);
        break;
      default:
        break;
    }
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "작업 중 오류가 발생했습니다.";
    postMessage({
      type: "ERROR",
      message: messageText
    });
    figma.notify(messageText, {
      error: true
    });
  }
};

void bootstrapUi();

