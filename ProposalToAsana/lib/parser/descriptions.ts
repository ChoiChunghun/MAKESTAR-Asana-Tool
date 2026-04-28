import type { OpenContext, ParsedItem } from "@/types/parser";
import { HANDWRITING_KEYWORDS } from "./constants";
import { hasKeyword } from "./utils";

export function buildPhotocardDescription(photocards: ParsedItem[]): string {
  let html = "<body><em>*더 필요한 산출물은 추가, 사용하지 않는 산출물은 삭제해주세요!</em>";
  for (const pc of photocards) {
    const hw = hasKeyword(pc.name, HANDWRITING_KEYWORDS) ? "O" : "X";
    html += `\n\n<strong>${escapeHtml(pc.name)} (${pc.count}종)</strong><ol>`;
    html += '<li>스펙<ol type="a"><li>(55*85가 아닐 경우, 주문 상세 페이지 URL 또는 스펙 공유)</li></ol></li>';
    html += `<li>문의<ol type="a"><li>손그림, 글씨 사용 여부 : ${hw}</li></ol></li>`;
    html += '<li>자료<ol type="a"><li>URL 또는 MAS 위치</li></ol></li>';
    html += "<li>공유, 요청<ol type=\"a\"><li>소속사 요청 사항, 디자인 컨셉, 아이디어 등 공유가 필요한 내용을 편하게 남겨주세요!</li></ol></li>";
    html += "</ol>";
  }
  return `${html}</body>`;
}

export function buildBenefitDescription(benefits: ParsedItem[]): string {
  let html = "<body><em>*더 필요한 산출물은 추가, 사용하지 않는 산출물은 삭제해주세요!</em>";
  for (const benefit of benefits) {
    const hw = hasKeyword(benefit.name, HANDWRITING_KEYWORDS) ? "O" : "X";
    html += `\n\n<strong>${escapeHtml(benefit.name)} (${benefit.count}종)</strong><ol>`;
    html += '<li>스펙<ol type="a"><li>주문 상세 페이지 URL</li><li>(또는 상품 스펙)</li></ol></li>';
    html += `<li>문의<ol type="a"><li>손그림, 글씨 사용 여부 : ${hw}</li></ol></li>`;
    html += '<li>자료<ol type="a"><li>URL 또는 MAS 위치</li></ol></li>';
    html += "<li>공유, 요청<ol type=\"a\"><li>소속사 요청 사항, 디자인 컨셉, 아이디어 등 공유가 필요한 내용을 편하게 남겨주세요!</li></ol></li>";
    html += "</ol>";
  }
  return `${html}</body>`;
}

export function buildUpdateDescription(photocards: ParsedItem[], benefits: ParsedItem[]): string {
  let html = "<body><strong>자료</strong><ol><li>URL 또는 MAS 위치</li></ol>";
  html += "\n\n<strong>문의</strong><ol><li>블러 강도 <strong>(3)</strong>단계</li><li>(자료 수급 일정)</li></ol>";
  html += "\n\n<strong>공유, 요청</strong><ol><li>소속사 요청 사항, 디자인 컨셉, 아이디어 등 공유가 필요한 내용을 편하게 남겨주세요!</li></ol>";

  const items = [
    ...photocards.map((pc) => `<li>${escapeHtml(pc.name)} (${pc.count}종)</li>`),
    ...benefits.map((benefit) => `<li>${escapeHtml(benefit.name)} (${benefit.count}종)</li>`)
  ];

  if (items.length > 0) {
    html += `\n\n<strong>필요한 산출물</strong><ol>${items.join("")}</ol>`;
    html += "\n\n<em>*더 필요한 산출물은 추가, 사용하지 않는 산출물은 삭제해주세요!</em>";
  }
  return `${html}</body>`;
}

export function buildOpenDescription(openContext: OpenContext): string {
  const outputItems = [
    "<li>메인 배너 (PC)</li>",
    "<li>메인 배너 (모바일)</li>",
    "<li>서브 배너</li>",
    `<li>스토리 ${openContext.storyCount}종</li>`
  ];
  if (openContext.includePackshot) outputItems.push("<li>팩샷</li>");

  const planningLink = openContext.planningUrl
    ? `<a href="${escapeHtml(openContext.planningUrl)}">URL &gt;</a>`
    : escapeHtml(openContext.planningLabel);

  let snsHtml = `<li>SNS ${openContext.snsItems.length}종 / ${planningLink}<ol type="a">`;
  for (const snsItem of openContext.snsItems) snsHtml += `<li>${escapeHtml(snsItem)}</li>`;
  snsHtml += "</ol></li>";
  outputItems.push(snsHtml);

  return `<body>${[
    "<em>*불필요한 내용은 삭제하셔도 좋습니다!</em>",
    `<strong>기획서</strong><ol><li>${planningLink}</li></ol>`,
    "<strong>자료</strong><ol><li>URL 또는 MAS 위치</li></ol>",
    `<strong>문의</strong><ol><li>통이미지 작업 필요 여부 : ${escapeHtml(openContext.compositeImageNeeded)}</li></ol>`,
    "<strong>공유, 요청</strong><ol><li>소속사 요청 사항, 디자인 컨셉, 아이디어 등 공유가 필요한 내용을 편하게 남겨주세요!</li></ol>",
    `<strong>필요한 산출물</strong><ol>${outputItems.join("")}</ol>`,
    "<em>*더 필요한 산출물을 추가, 사용하지 않는 산출물은 삭제해주세요!</em>"
  ].join("\n")}</body>`;
}

export function buildVmdDescription(openContext: OpenContext): string {
  let html = "<body><em>*더 필요한 산출물은 추가, 사용하지 않는 산출물은 삭제해주세요!</em>";
  for (let index = 0; index < openContext.vmdItemCount; index += 1) {
    const label = String.fromCharCode("A".charCodeAt(0) + index);
    html += `\n\n<strong>항목 ${label}</strong><ol>`;
    html += '<li>스펙<ol type="a"><li>주문 상세 페이지 URL</li><li>(또는 상품 스펙)</li></ol></li>';
    html += '<li>문의<ol type="a"><li>손그림, 글씨 사용 여부 : X</li></ol></li>';
    html += '<li>자료<ol type="a"><li>URL 또는 MAS 위치</li></ol></li>';
    html += "<li>공유, 요청<ol type=\"a\"><li>소속사 요청 사항, 디자인 컨셉, 아이디어 등 공유가 필요한 내용을 편하게 남겨주세요!</li></ol></li>";
    html += "</ol>";
  }
  return `${html}</body>`;
}

function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
