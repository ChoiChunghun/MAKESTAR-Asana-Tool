const SPREADSHEET_ID_PATTERN = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;

export function extractSpreadsheetId(spreadsheetUrl: string): string {
  const trimmed = String(spreadsheetUrl || "").trim();
  const match = trimmed.match(SPREADSHEET_ID_PATTERN);
  if (match?.[1]) {
    return match[1];
  }

  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  throw new Error("유효한 Google Spreadsheet URL 또는 Spreadsheet ID가 아닙니다.");
}

export function buildSpreadsheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

