import { ASSIGNEE_GID, TESTFARM_GID } from "@/lib/parser/constants";

type AsanaMethod = "get" | "post" | "put" | "delete";

export class AsanaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string
  ) {
    super(message);
    this.name = "AsanaApiError";
  }
}

export function getAsanaToken(): string {
  const token = process.env.ASANA_TOKEN;
  if (!token || token.length < 10) {
    throw new Error("Asana 토큰이 설정되지 않았습니다. .env.local 파일에 ASANA_TOKEN을 설정해주세요.");
  }
  return token;
}

export function getDefaultProjectGid(): string {
  return process.env.ASANA_DEFAULT_PROJECT_GID || TESTFARM_GID;
}

export function getAssigneeGid(): string {
  return process.env.ASANA_ASSIGNEE_GID || ASSIGNEE_GID;
}

export async function asanaRequest<T>(method: AsanaMethod, endpoint: string, payload?: unknown): Promise<T> {
  const response = await fetch(`https://app.asana.com/api/1.0${endpoint}`, {
    method: method.toUpperCase(),
    headers: {
      Authorization: `Bearer ${getAsanaToken()}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: payload !== undefined && method !== "get" && method !== "delete" ? JSON.stringify({ data: payload }) : undefined,
    cache: "no-store"
  });

  if (response.status === 204) return null as T;

  const body = (await response.json().catch(() => ({}))) as { data?: T; errors?: Array<{ message?: string }> };
  if (!response.ok) {
    const message = body.errors?.[0]?.message || `HTTP ${response.status}`;
    throw new AsanaApiError(message, response.status, endpoint);
  }

  return body.data as T;
}
