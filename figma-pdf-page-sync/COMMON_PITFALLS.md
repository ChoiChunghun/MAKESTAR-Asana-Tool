# PDF Page Sync 자주 틀리는 부분

## 1. `devDomains`를 쓰면 안 됨

Figma manifest에는 `networkAccess.devAllowedDomains`를 사용합니다. `devDomains`는 사용하지 않습니다.

## 2. 첫 실행에서 fetch를 하면 부팅 실패 원인 파악이 어려움

이번 버전은 플러그인 실행 직후 네트워크 요청을 하지 않습니다. `Real Sync` 버튼을 눌렀을 때만 manifest를 fetch합니다.

## 3. 첫 실행에서 image fill을 바꾸면 안 됨

이미지 URL, 네트워크, Figma image API 중 어디서 실패했는지 분리하기 어렵습니다. `Test Sync` 버튼을 눌렀을 때만 샘플 이미지 fill을 적용합니다.

## 4. `allowedDomains: ["*"]`로 시작하지 않음

초기 안정성 검증 단계에서는 `allowedDomains: ["none"]`으로 시작하고, 개발 중에는 `devAllowedDomains: ["http://localhost:9910"]`만 사용합니다.

## 5. `127.0.0.1`을 섞지 않음

manifest와 샘플 서버는 모두 `http://localhost:9910` 기준입니다. `127.0.0.1`을 섞으면 허용 도메인과 실제 요청 도메인이 달라져 실패할 수 있습니다.

## 6. pluginData JSON.parse는 반드시 보호

pluginData는 문자열 저장소이므로 과거 버전의 깨진 값이 남을 수 있습니다. `readNodeMapping`은 JSON.parse 실패를 UI와 console에 표시하고 플러그인을 죽이지 않습니다.

## 7. selection에는 다양한 node type이 들어올 수 있음

이번 버전은 Rectangle과 Frame만 지원합니다. 그 외 타입은 실패가 아니라 skip으로 처리합니다.

## 8. manifest URL과 base URL을 구분

입력값이 `.json`으로 끝나면 manifest URL로 사용합니다. 그렇지 않으면 base URL로 보고 `{baseUrl}/{sourcePdfId}/manifest.json`을 만듭니다.

## 9. Figma Desktop에서 개발 플러그인으로 테스트

`devAllowedDomains`는 개발 플러그인 테스트를 위한 설정입니다. 배포 단계에서 외부 도메인을 쓰려면 `allowedDomains`를 명시 도메인으로 바꿔야 합니다.
