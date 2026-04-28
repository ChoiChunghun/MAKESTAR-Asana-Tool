import { AsanaApiError } from "./client";

export function toUserFriendlyAsanaError(error: unknown): string {
  if (error instanceof AsanaApiError) {
    if (error.status === 401) {
      return "Asana 인증에 실패했습니다. ASANA_TOKEN 값이 올바른지 확인해주세요.";
    }
    if (error.status === 403) {
      return "Asana 권한이 부족합니다. 토큰 사용자가 해당 프로젝트와 태스크 생성 권한을 가지고 있는지 확인해주세요.";
    }
    if (error.status === 404) {
      return "Asana에서 프로젝트, 섹션, 커스텀필드 또는 태스크를 찾지 못했습니다. 선택한 프로젝트가 올바른지 확인해주세요.";
    }
    if (error.status === 429) {
      return "Asana 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.";
    }
    return `Asana API 오류 (${error.status}): ${error.message}`;
  }

  if (error instanceof TypeError) {
    return "Asana 서버에 연결하지 못했습니다. 네트워크 상태를 확인해주세요.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Asana 처리 중 알 수 없는 오류가 발생했습니다.";
}
