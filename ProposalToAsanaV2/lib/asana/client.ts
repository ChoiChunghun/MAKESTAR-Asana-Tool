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

export async function asanaRequest<T>(
  method: AsanaMethod,
  endpoint: string,
  token: string,
  payload?: unknown
): Promise<T> {
  const response = await fetch(`https://app.asana.com/api/1.0${endpoint}`, {
    method: method.toUpperCase(),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body:
      payload !== undefined && method !== "get" && method !== "delete"
        ? JSON.stringify({ data: payload })
        : undefined,
    cache: "no-store"
  });

  if (response.status === 204) return null as T;

  const body = (await response.json().catch(() => ({}))) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };

  if (!response.ok) {
    const message = body.errors?.[0]?.message || `HTTP ${response.status}`;
    throw new AsanaApiError(message, response.status, endpoint);
  }

  return body.data as T;
}

export function validateToken(token: string): void {
  if (!token || token.trim().length < 10) {
    throw new AsanaApiError(
      "Asana 토큰이 유효하지 않습니다. 설정에서 Personal Access Token을 입력해주세요.",
      401,
      "/validate"
    );
  }
}

export async function getCurrentUserGid(token: string): Promise<string> {
  const user = await asanaRequest<{ gid: string }>("get", "/users/me", token);
  return user?.gid ?? "";
}

export async function getCurrentUser(token: string): Promise<{ gid: string; name: string }> {
  const user = await asanaRequest<{ gid: string; name: string }>(
    "get",
    "/users/me?opt_fields=gid,name",
    token
  );
  return { gid: user?.gid ?? "", name: user?.name ?? "" };
}
