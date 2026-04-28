export const PLUGIN_DATA_KEY = "pdfPageSync.mapping.v1";
export const TEST_IMAGE_URL = "http://localhost:9910/sample-assets/test-image.png";
export const DEFAULT_MANIFEST_BASE_URL = "http://localhost:9910/sample-assets";

export interface MappingData {
  sourcePdfId: string;
  pageNumber: number;
  syncEnabled: boolean;
}

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  time: string;
}

export interface SelectionNodeInfo {
  id: string;
  name: string;
  type: string;
  supported: boolean;
  mapping?: MappingData;
  mappingError?: string;
}

export interface SelectionSnapshot {
  ok: boolean;
  count: number;
  supportedCount: number;
  skippedCount: number;
  nodes: SelectionNodeInfo[];
  error?: string;
}

export interface OperationIssue {
  nodeId?: string;
  nodeName?: string;
  level: LogLevel;
  message: string;
}

export interface OperationResult {
  ok: boolean;
  action: string;
  message: string;
  issues: OperationIssue[];
  selection?: SelectionSnapshot;
}

export interface PdfManifest {
  schemaVersion?: number;
  sourcePdfId?: string;
  version?: string;
  pageCount?: number;
  pages: Record<string, string | { url?: string }>;
}

export type UiToPluginMessage =
  | { type: "ui-ready" }
  | { type: "request-selection" }
  | { type: "connect"; sourcePdfId: string; pageNumber: number }
  | { type: "read-mapping" }
  | { type: "test-sync" }
  | { type: "real-sync"; manifestInput: string };

export type PluginToUiMessage =
  | { type: "boot-state"; bootStatus: string; selection: SelectionSnapshot }
  | { type: "selection-state"; selection: SelectionSnapshot }
  | { type: "operation-result"; result: OperationResult }
  | { type: "log"; entry: LogEntry };
