import { DEFAULT_MANIFEST_BASE_URL, type LogEntry, type OperationIssue, type OperationResult, type PluginToUiMessage, type SelectionSnapshot, type UiToPluginMessage } from "./shared/types";

const logEntries: LogEntry[] = [];

const refs = {
  bootStatus: byId("bootStatus"),
  selectionCount: byId("selectionCount"),
  selectionRead: byId("selectionRead"),
  currentSource: byId("currentSource"),
  sourcePdfId: byId<HTMLInputElement>("sourcePdfId"),
  pageNumber: byId<HTMLInputElement>("pageNumber"),
  manifestInput: byId<HTMLInputElement>("manifestInput"),
  connectButton: byId<HTMLButtonElement>("connectButton"),
  readMappingButton: byId<HTMLButtonElement>("readMappingButton"),
  testSyncButton: byId<HTMLButtonElement>("testSyncButton"),
  realSyncButton: byId<HTMLButtonElement>("realSyncButton"),
  mappingResult: byId("mappingResult"),
  operationResult: byId("operationResult"),
  log: byId("log")
};

refs.manifestInput.value = DEFAULT_MANIFEST_BASE_URL;
refs.sourcePdfId.addEventListener("input", () => {
  refs.currentSource.textContent = refs.sourcePdfId.value || "(empty)";
});

refs.connectButton.addEventListener("click", () => safeButton("connect", () => {
  post({
    type: "connect",
    sourcePdfId: refs.sourcePdfId.value,
    pageNumber: Number(refs.pageNumber.value)
  });
}));

refs.readMappingButton.addEventListener("click", () => safeButton("read-mapping", () => {
  post({ type: "read-mapping" });
}));

refs.testSyncButton.addEventListener("click", () => safeButton("test-sync", () => {
  post({ type: "test-sync" });
}));

refs.realSyncButton.addEventListener("click", () => safeButton("real-sync", () => {
  post({
    type: "real-sync",
    manifestInput: refs.manifestInput.value
  });
}));

window.onmessage = (event: MessageEvent<{ pluginMessage?: PluginToUiMessage }>) => {
  try {
    const message = event.data.pluginMessage;
    if (!message) {
      return;
    }

    if (message.type === "boot-state") {
      refs.bootStatus.textContent = message.bootStatus;
      renderSelection(message.selection);
      addLog({ level: "info", message: "[ui] boot-state received", time: new Date().toLocaleTimeString() });
    }

    if (message.type === "selection-state") {
      renderSelection(message.selection);
    }

    if (message.type === "operation-result") {
      renderOperationResult(message.result);
    }

    if (message.type === "log") {
      addLog(message.entry);
    }
  } catch (error) {
    addLog({ level: "error", message: `[error] UI message handler failed: ${error instanceof Error ? error.message : String(error)}`, time: new Date().toLocaleTimeString() });
  }
};

addLog({ level: "info", message: "[ui] ready", time: new Date().toLocaleTimeString() });
post({ type: "ui-ready" });

function renderSelection(selection: SelectionSnapshot) {
  refs.selectionCount.textContent = String(selection.count);
  refs.selectionRead.textContent = selection.ok ? "success" : "failed";
  refs.selectionRead.className = selection.ok ? "ok" : "error";

  if (!selection.ok) {
    refs.mappingResult.textContent = selection.error || "Selection read failed.";
    refs.mappingResult.className = "result error";
  }
}

function renderOperationResult(result: OperationResult) {
  const lines = [
    `${result.ok ? "OK" : "Needs attention"}: ${result.message}`,
    result.selection ? `selection: ${result.selection.count}, supported: ${result.selection.supportedCount}, skipped: ${result.selection.skippedCount}` : "",
    ...result.issues.map(formatIssue)
  ].filter(Boolean);

  refs.operationResult.textContent = lines.join("\n");
  refs.operationResult.className = `result ${result.ok ? "ok" : "warn"}`;

  if (result.action === "read-mapping" || result.action === "connect") {
    refs.mappingResult.textContent = renderMappingText(result.selection);
    refs.mappingResult.className = "result";
  }

  addLog({
    level: result.ok ? "info" : "warn",
    message: `[ui] operation result: ${result.action}`,
    time: new Date().toLocaleTimeString()
  });
}

function renderMappingText(selection?: SelectionSnapshot): string {
  if (!selection) {
    return "No selection snapshot returned.";
  }
  if (selection.count === 0) {
    return "No selection. Select Rectangle or Frame nodes first.";
  }

  return selection.nodes
    .map((node) => {
      if (!node.supported) {
        return `${node.name} (${node.type}): skipped unsupported type`;
      }
      if (node.mappingError) {
        return `${node.name}: mapping error - ${node.mappingError}`;
      }
      if (!node.mapping) {
        return `${node.name}: no mapping`;
      }
      return `${node.name}: ${node.mapping.sourcePdfId} page ${node.mapping.pageNumber}, syncEnabled=${node.mapping.syncEnabled}`;
    })
    .join("\n");
}

function formatIssue(issue: OperationIssue): string {
  const target = issue.nodeName ? `${issue.nodeName}: ` : "";
  return `[${issue.level}] ${target}${issue.message}`;
}

function safeButton(name: string, fn: () => void) {
  try {
    addLog({ level: "info", message: `[ui] ${name} clicked`, time: new Date().toLocaleTimeString() });
    fn();
  } catch (error) {
    addLog({ level: "error", message: `[error] ${name} handler failed: ${error instanceof Error ? error.message : String(error)}`, time: new Date().toLocaleTimeString() });
  }
}

function addLog(entry: LogEntry) {
  logEntries.unshift(entry);
  if (logEntries.length > 20) {
    logEntries.length = 20;
  }

  refs.log.textContent = logEntries
    .map((item) => `[${item.time}] ${item.level.toUpperCase()} ${item.message}`)
    .join("\n");
}

function post(message: UiToPluginMessage) {
  parent.postMessage({ pluginMessage: message }, "*");
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing UI element: ${id}`);
  }
  return element as T;
}
