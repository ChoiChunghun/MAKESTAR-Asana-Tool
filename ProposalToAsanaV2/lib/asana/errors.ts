import { AsanaApiError } from "./client";

export function toUserFriendlyAsanaError(error: unknown): string {
  if (error instanceof AsanaApiError) {
    switch (error.status) {
      case 401:
        return "Asana 토큰이 올바르지 않거나 만료되었습니다. 설정에서 새 토큰을 입력해주세요.";
      case 403:
        return "해당 Asana 프로젝트에 대한 접근 권한이 없습니다.";
      case 404:
        return "Asana 리소스를 찾을 수 없습니다. 프로젝트 GID를 확인해주세요.";
      case 429:
        return "Asana API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.";
      case 500:
      case 503:
        return "Asana 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.";
      default:
        return `Asana 오류: ${error.message}`;
    }
  }
  if (error instanceof Error) return error.message;
  return "알 수 없는 오류가 발생했습니다.";
}
