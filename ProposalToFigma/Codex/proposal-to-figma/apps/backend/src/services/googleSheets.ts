import { google } from "googleapis";

import type { ProposalRange, SheetReaderInput, SheetRow } from "../types";
import { extractSpreadsheetId } from "../utils/spreadsheetUrl";

type VisibleSheet = {
  title: string;
  index: number;
};

const SHEETS_SCOPE = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
const DEFAULT_RANGE: ProposalRange = "B:B";

function buildGoogleCredentials():
  | { credentials: { client_email?: string; private_key?: string; [key: string]: unknown } }
  | undefined {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return {
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    };
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return {
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      }
    };
  }

  return undefined;
}

async function createSheetsClient() {
  if (process.env.GOOGLE_API_KEY) {
    return google.sheets({
      version: "v4",
      auth: process.env.GOOGLE_API_KEY
    });
  }

  const authConfig = buildGoogleCredentials();
  const auth = new google.auth.GoogleAuth({
    ...authConfig,
    scopes: SHEETS_SCOPE
  });

  return google.sheets({
    version: "v4",
    auth
  });
}

async function resolveSheetName(spreadsheetId: string, requestedSheetName?: string): Promise<string> {
  const sheets = await createSheetsClient();
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(title,index,hidden))"
  });

  const visibleSheets: VisibleSheet[] = (response.data.sheets ?? [])
    .map((sheet) => ({
      title: sheet.properties?.title ?? "",
      index: sheet.properties?.index ?? Number.MAX_SAFE_INTEGER,
      hidden: Boolean(sheet.properties?.hidden)
    }))
    .filter((sheet) => !sheet.hidden && sheet.title)
    .sort((a, b) => a.index - b.index)
    .map(({ title, index }) => ({ title, index }));

  if (!visibleSheets.length) {
    throw new Error("읽을 수 있는 visible sheet를 찾지 못했습니다.");
  }

  if (requestedSheetName) {
    const match = visibleSheets.find((sheet) => sheet.title === requestedSheetName);
    if (!match) {
      throw new Error(`시트를 찾지 못했습니다: ${requestedSheetName}`);
    }
    return match.title;
  }

  return visibleSheets[0]!.title;
}

export async function readProposalColumnB(
  input: SheetReaderInput
): Promise<{ spreadsheetId: string; sheetName: string; range: ProposalRange; rows: SheetRow[] }> {
  const spreadsheetId = extractSpreadsheetId(input.spreadsheetUrl);
  const range = input.range ?? DEFAULT_RANGE;
  const sheetName = await resolveSheetName(spreadsheetId, input.sheetName);
  const sheets = await createSheetsClient();

  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: [`${sheetName}!${range}`],
      includeGridData: true,
      fields: "sheets(properties(title),data(rowData(values(formattedValue))))"
    });

    const rowData = response.data.sheets?.[0]?.data?.[0]?.rowData ?? [];
    const rows = rowData.map((row, index) => {
      const value = row.values?.[0]?.formattedValue ?? "";
      return {
        rowNumber: index + 1,
        value,
        sourceRef: `${sheetName}!B${index + 1}`
      };
    });

    return {
      spreadsheetId,
      sheetName,
      range,
      rows
    };
  } catch (error) {
    const message = String(error);
    if (message.includes("403") || message.includes("The caller does not have permission")) {
      throw new Error(
        "Google Sheet에 접근할 수 없습니다.\n시트 공유 권한을 확인하거나, 연결된 Google 계정이 해당 문서에 접근 가능한지 확인해 주세요."
      );
    }
    throw error;
  }
}
