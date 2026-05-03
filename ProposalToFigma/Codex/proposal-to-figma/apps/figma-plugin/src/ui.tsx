import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import type {
  DesignOutput,
  DiffDesignResponse,
  ParseSheetResponse,
  PluginToUiMessage,
  SelectionBindingSummary,
  UiToPluginMessage
} from "./shared/types";

const styles = {
  page: {
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    background: "linear-gradient(180deg, #f5efe3 0%, #fffaf4 100%)",
    color: "#1d1b17",
    minHeight: "100vh",
    padding: 16
  } as const,
  section: {
    background: "#fffdf8",
    border: "1px solid #e2d6c3",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    boxShadow: "0 6px 18px rgba(68, 52, 28, 0.06)"
  } as const,
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cfbea3",
    background: "#fff",
    boxSizing: "border-box" as const
  },
  button: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    background: "#1f5eff",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer"
  } as const,
  secondaryButton: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cfbea3",
    background: "#fff",
    color: "#1d1b17",
    fontWeight: 600,
    cursor: "pointer"
  } as const,
  tiny: {
    fontSize: 12,
    color: "#6a5c46"
  } as const,
  pre: {
    whiteSpace: "pre-wrap" as const,
    fontSize: 12,
    background: "#f6f0e6",
    padding: 10,
    borderRadius: 10,
    overflowX: "auto" as const
  }
};

function postPluginMessage(message: UiToPluginMessage): void {
  parent.postMessage(
    {
      pluginMessage: message
    },
    "*"
  );
}

function App() {
  const [backendBaseUrl, setBackendBaseUrl] = useState("http://127.0.0.1:8787");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(
    "https://docs.google.com/spreadsheets/d/1fUxLBNUtTE9dZcIx1AqXAzH7-DlXjBG5PCdZ_ojBfDA/edit?usp=sharing"
  );
  const [sheetName, setSheetName] = useState("");
  const [range, setRange] = useState("B:B");
  const [parseResult, setParseResult] = useState<ParseSheetResponse | null>(null);
  const [syncResult, setSyncResult] = useState<DiffDesignResponse | null>(null);
  const [selection, setSelection] = useState<SelectionBindingSummary>({
    hasSelection: false,
    hasBinding: false
  });
  const [selectedOutputIds, setSelectedOutputIds] = useState<string[]>([]);
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");

  useEffect(() => {
    function handleMessage(event: MessageEvent<{ pluginMessage?: PluginToUiMessage }>) {
      const pluginMessage = event.data?.pluginMessage;
      if (!pluginMessage) {
        return;
      }

      switch (pluginMessage.type) {
        case "BOOTSTRAP":
          setBackendBaseUrl(pluginMessage.backendBaseUrl);
          setSelection(pluginMessage.selection);
          break;
        case "PARSE_RESULT":
          setParseResult(pluginMessage.payload);
          setSelectedOutputIds(pluginMessage.payload.designData.outputs.map((output) => output.outputId));
          setSyncResult(null);
          setStatus("Sheet parsed successfully.");
          setError("");
          break;
        case "GENERATE_RESULT":
          setStatus(`${pluginMessage.created.length} outputs generated.`);
          setError("");
          break;
        case "SYNC_RESULT":
          setSyncResult(pluginMessage.payload);
          setStatus(pluginMessage.payload.hasChanges ? "Changes detected." : "No changes detected.");
          setError("");
          break;
        case "APPLY_RESULT":
          setStatus(`${pluginMessage.outputId} updated.`);
          setError("");
          break;
        case "SELECTION_CHANGED":
          setSelection(pluginMessage.selection);
          break;
        case "INFO":
          setStatus(pluginMessage.message);
          break;
        case "ERROR":
          setError(pluginMessage.message);
          setStatus("Error");
          break;
        default:
          break;
      }
    }

    window.addEventListener("message", handleMessage);
    postPluginMessage({ type: "INIT" });
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const selectedOutputs = useMemo(() => {
    if (!parseResult) {
      return [];
    }
    return parseResult.designData.outputs.filter((output) => selectedOutputIds.includes(output.outputId));
  }, [parseResult, selectedOutputIds]);

  function triggerParse(): void {
    setStatus("Parsing sheet...");
    setError("");
    postPluginMessage({
      type: "PARSE_SHEET",
      backendBaseUrl,
      input: {
        spreadsheetUrl,
        sheetName: sheetName || undefined,
        range: range as "B:B"
      }
    });
  }

  function toggleOutput(outputId: string): void {
    setSelectedOutputIds((current) =>
      current.includes(outputId) ? current.filter((candidate) => candidate !== outputId) : [...current, outputId]
    );
  }

  function generateOutputs(outputIds: string[]): void {
    if (!parseResult) {
      return;
    }
    setStatus("Generating outputs...");
    postPluginMessage({
      type: "GENERATE_OUTPUTS",
      designData: parseResult.designData,
      outputIds
    });
  }

  function requestDiff(): void {
    setStatus("Checking updates...");
    setError("");
    postPluginMessage({
      type: "CHECK_UPDATES",
      backendBaseUrl
    });
  }

  function applyUpdates(): void {
    if (!syncResult) {
      return;
    }
    setStatus("Applying updates...");
    postPluginMessage({
      type: "APPLY_UPDATES",
      designData: syncResult.designData,
      output: syncResult.output
    });
  }

  function renderOutput(output: DesignOutput) {
    const isSelected = selectedOutputIds.includes(output.outputId);

    return (
      <div
        key={output.outputId}
        style={{
          border: isSelected ? "1px solid #1f5eff" : "1px solid #dfd0ba",
          borderRadius: 12,
          padding: 12,
          marginBottom: 10,
          background: isSelected ? "#f3f7ff" : "#fff"
        }}
      >
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <input checked={isSelected} onChange={() => toggleOutput(output.outputId)} type="checkbox" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{output.outputType}</div>
            <div style={styles.tiny}>{output.templateLabel}</div>
            <div style={{ ...styles.tiny, marginTop: 6 }}>componentProps</div>
            <pre style={styles.pre}>{JSON.stringify(output.componentProps, null, 2)}</pre>
            <div style={{ ...styles.tiny, marginTop: 6 }}>textBindings</div>
            <pre style={styles.pre}>{JSON.stringify(output.textBindings, null, 2)}</pre>
            <div style={{ ...styles.tiny, marginTop: 6 }}>reviewFlags</div>
            <pre style={styles.pre}>{JSON.stringify(output.reviewFlags, null, 2)}</pre>
          </div>
        </label>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Proposal to Figma</div>
        <div style={styles.tiny}>Google Sheet B열 기반 MVP Generator</div>
      </div>

      <section style={styles.section}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Source</div>
        <div style={{ display: "grid", gap: 8 }}>
          <input
            style={styles.input}
            value={backendBaseUrl}
            onChange={(event) => {
              setBackendBaseUrl(event.target.value);
              postPluginMessage({ type: "SAVE_BACKEND_URL", backendBaseUrl: event.target.value });
            }}
            placeholder="Backend URL"
          />
          <input
            style={styles.input}
            value={spreadsheetUrl}
            onChange={(event) => setSpreadsheetUrl(event.target.value)}
            placeholder="Google Sheet URL"
          />
          <input
            style={styles.input}
            value={sheetName}
            onChange={(event) => setSheetName(event.target.value)}
            placeholder="Sheet tab (optional)"
          />
          <input style={styles.input} value={range} onChange={(event) => setRange(event.target.value)} placeholder="Range" />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={styles.secondaryButton} onClick={triggerParse}>
            Connect
          </button>
          <button style={styles.button} onClick={triggerParse}>
            Parse
          </button>
        </div>
        {parseResult && (
          <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
            <div style={styles.tiny}>읽은 행 수: {parseResult.proposalData.rawRows.length}</div>
            <div style={styles.tiny}>이벤트명: {parseResult.proposalData.eventTitle}</div>
            <div style={styles.tiny}>
              아티스트 / 앨범: {parseResult.proposalData.artistName || "-"} / {parseResult.proposalData.albumName || "-"}
            </div>
            <div style={styles.tiny}>
              기간:{" "}
              {parseResult.proposalData.schedule.salesPeriod ||
                parseResult.proposalData.schedule.applyPeriod ||
                parseResult.proposalData.schedule.eventDate ||
                "-"}
            </div>
            <div style={styles.tiny}>특전 개수: {parseResult.proposalData.benefits.length}</div>
          </div>
        )}
      </section>

      <section style={styles.section}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Output Preview</div>
        {parseResult ? parseResult.designData.outputs.map(renderOutput) : <div style={styles.tiny}>먼저 Parse를 실행해 주세요.</div>}
        {parseResult && (
          <div style={{ display: "flex", gap: 8 }}>
            <button style={styles.secondaryButton} onClick={() => generateOutputs(selectedOutputIds)} disabled={!selectedOutputs.length}>
              Generate Selected
            </button>
            <button
              style={styles.button}
              onClick={() => generateOutputs(parseResult.designData.outputs.map((output) => output.outputId))}
            >
              Generate All
            </button>
          </div>
        )}
      </section>

      <section style={styles.section}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Sync</div>
        <div style={styles.tiny}>선택 상태: {selection.hasSelection ? selection.nodeName : "선택 없음"}</div>
        <div style={styles.tiny}>Binding: {selection.hasBinding ? "Connected" : "Not found"}</div>
        <div style={styles.tiny}>Output: {selection.outputType || "-"}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={styles.secondaryButton} onClick={requestDiff} disabled={!selection.hasBinding}>
            Check Updates
          </button>
          <button style={styles.button} onClick={applyUpdates} disabled={!syncResult?.hasChanges}>
            Apply Updates
          </button>
        </div>
        {syncResult && (
          <div style={{ marginTop: 10 }}>
            <div style={styles.tiny}>currentSourceHash: {syncResult.currentSourceHash}</div>
            <div style={{ ...styles.tiny, marginTop: 6 }}>changedFields</div>
            <pre style={styles.pre}>{JSON.stringify(syncResult.changedFields, null, 2)}</pre>
          </div>
        )}
      </section>

      <section style={styles.section}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Status</div>
        <div style={styles.tiny}>{status}</div>
        {error ? <pre style={{ ...styles.pre, color: "#8f2020", marginTop: 8 }}>{error}</pre> : null}
      </section>
    </div>
  );
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container not found.");
}

createRoot(container).render(<App />);
