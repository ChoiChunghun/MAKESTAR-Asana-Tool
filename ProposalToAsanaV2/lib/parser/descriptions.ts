import type { OpenContext, ParsedItem } from "@/types/parser";
import { HANDWRITING_KEYWORDS } from "./constants";
import { hasKeyword } from "./utils";
import { detectVenues, VENUE_DISPLAY, type VenueKey } from "./parseOpenContext";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildPhotocardDescription(pcs: ParsedItem[]): string {
  let html = "<body><em>*더 필요한 산출물은 추가, 사용하지 않는 산출물은 삭제해주세요!</em>";
  for (const pc of pcs) {
    const hw = hasKeyword(pc.name, HANDWRITING_KEYWORDS) ? "O" : "X";
    html += `\n\n<strong>${esc(pc.name)} (${pc.count}종)</strong><ol>`;
    html += '<li>스펙<ol type="a"><li>(55*85가 아닐 경우, 주문 상세 페이지 URL 또는 스펙 공유)</li></ol></li>';
    html += `<li>문의<ol type="a"><li>손그림, 글씨 사용 여부 : ${hw}</li></ol></li>`;
    html += '<li>자료<ol type="a"><li>URL 또는 MAS 위치</li></ol></li>';
    html += '<li>공유, 요청<ol type="a"><li>소속사 요청 사항, 디자인 컨셉, 아이디어 등 공유가 필요한 내용을 편하게 남겨주세요!</li></ol></li>';
    html += "</ol>";
  }
  return `${html}</body>`;
}

export function buildBenefitDescription(benefits: ParsedItem[]): string {
  let html = "<body><em>*더 필요한 산출물은 추가, 사용하지 않는 산출물은 삭제해주세요!</em>";

  // 파싱된 특전이 없으면 빈 항목 1개를 플레이스홀더로 삽입
  const items = benefits.length > 0 ? benefits : [{ name: "특전 항목", count: 1 }];

  for (const b of items) {
    const hw = b.hasHandwriting || hasKeyword(b.name, HANDWRITING_KEYWORDS) ? "O" : "X";
    html += `\n\n<strong>${esc(b.name)} (${b.count}종)</strong><ol>`;
    html += '<li>스펙<ol type="a"><li>주문 상세 페이지 URL</li><li>(또는 상품 스펙)</li></ol></li>';
    html += `<li>문의<ol type="a"><li>손그림, 글씨 사용 여부 : ${hw}</li></ol></li>`;
    html += '<li>자료<ol type="a"><li>URL 또는 MAS 위치</li></ol></li>';
    html += '<li>공유, 요청<ol type="a"><li>소속사 요청 사항, 디자인 컨셉, 아이디어 등 공유가 필요한 내용을 편하게 남겨주세요!</li></ol></li>';
    html += "</ol>";
  }
  return `${html}</body>`;
}

export function buildUpdateDescription(pcs: ParsedItem[], benefits: ParsedItem[]): string {
  let html = "<body><strong>자료</strong><ol><li>URL 또는 MAS 위치</li></ol>";
  html += "\n\n<strong>문의</strong><ol><li>블러 강도 <strong>(3)</strong>단계</li><li>(자료 수급 일정)</li></ol>";
  html += "\n\n<strong>공유, 요청</strong><ol><li>소속사 요청 사항, 디자인 컨셉, 아이디어 등 공유가 필요한 내용을 편하게 남겨주세요!</li></ol>";
  const items = [
    ...pcs.map((pc) => `<li>${esc(pc.name)} (${pc.count}종)</li>`),
    ...benefits.map((b) => `<li>${esc(b.name)} (${b.count}종)</li>`)
  ];
  if (items.length) {
    html += `\n\n<strong>필요한 산출물</strong><ol>${items.join("")}</ol>`;
    html += "\n\n<em>*더 필요한 산출물은 추가, 사용하지 않는 산출물은 삭제해주세요!</em>";
  }
  return `${html}</body>`;
}

export function buildOpenDescription(ctx: OpenContext): string {
  const outputItems = [
    "<li>메인 배너 (PC)</li>",
    "<li>메인 배너 (모바일)</li>",
    "<li>서브 배너</li>",
    `<li>스토리 ${ctx.storyCount}종</li>`
  ];
  if (ctx.includePackshot) outputItems.push("<li>팩샷</li>");

  // 업로드 파일명 대신 항상 "URL" 표시 (담당자가 직접 링크 기입)
  const planLink = ctx.planningUrl
    ? `<a href="${esc(ctx.planningUrl)}">URL &gt;</a>`
    : "URL";

  // SNS 항목: 종수만 표기, 링크 제거
  let snsHtml = `<li>SNS ${ctx.snsItems.length}종<ol type="a">`;
  for (const item of ctx.snsItems) snsHtml += `<li>${esc(item)}</li>`;
  snsHtml += "</ol></li>";
  outputItems.push(snsHtml);

  return `<body>${[
    "<em>*불필요한 내용은 삭제하셔도 좋습니다!</em>",
    `<strong>기획서</strong><ol><li>${planLink}</li></ol>`,
    "<strong>자료</strong><ol><li>URL 또는 MAS 위치</li></ol>",
    `<strong>문의</strong><ol><li>통이미지 작업 필요 여부 : ${esc(ctx.compositeImageNeeded)}</li></ol>`,
    "<strong>공유, 요청</strong><ol><li>소속사 요청 사항, 디자인 컨셉, 아이디어 등 공유가 필요한 내용을 편하게 남겨주세요!</li></ol>",
    `<strong>필요한 산출물</strong><ol>${outputItems.join("")}</ol>`,
    "<em>*더 필요한 산출물을 추가, 사용하지 않는 산출물은 삭제해주세요!</em>"
  ].join("\n")}</body>`;
}

export function buildVmdDescription(ctx: OpenContext): string {
  const venues = detectVenues(ctx.venue);

  // 기본 (venue 미지정 또는 알 수 없는 장소)
  if (venues.length === 0) {
    let html = "<body><em>*더 필요한 산출물은 추가, 사용하지 않는 산출물은 삭제해주세요!</em>";
    for (let i = 1; i <= ctx.vmdItemCount; i++) {
      html += `\n\n<strong>VMD ${i}</strong><ol>`;
      html += '<li>스펙<ol type="a"><li>공간명 및 사이즈</li></ol></li>';
      html += '<li>자료<ol type="a"><li>URL 또는 MAS 위치</li></ol></li>';
      html += '<li>공유, 요청<ol type="a"><li>소속사 요청 사항 등을 편하게 남겨주세요!</li></ol></li>';
      html += "</ol>";
    }
    return `${html}</body>`;
  }

  // 단일 장소 — 헤더 없이 기존 포맷
  if (venues.length === 1) {
    return `<body><em>*더 필요한 산출물은 추가, 사용하지 않는 산출물은 삭제해주세요!</em>${vmdItemsHtml(venues[0])}</body>`;
  }

  // 복수 장소 — 장소별 섹션 헤더 포함
  let html = "<body><em>*더 필요한 산출물은 추가, 사용하지 않는 산출물은 삭제해주세요!</em>";
  for (const v of venues) {
    html += `\n\n<strong>▶ ${esc(VENUE_DISPLAY[v])}</strong>`;
    html += vmdItemsHtml(v);
  }
  return `${html}</body>`;
}

/** 장소별 항목 HTML (body 래퍼 없음, 앞에 \n\n 포함) */
function vmdItemsHtml(venueKey: VenueKey): string {
  switch (venueKey) {
    case "드림홀":          return vmdItemsDreamhall();
    case "스페이스강남":    return vmdItemsSpaceGangnam();
    case "스페이스상하이":  return vmdItemsSpaceShanghai();
    case "스페이스광저우":  return vmdItemsSpaceGuangzhou();
    case "스페이스심천":    return vmdItemsSpaceShenzhen();
  }
}

function vmdItemsDreamhall(): string {
  let html = "\n\n<strong>배경 스크린</strong><ol>";
  html += '<li>스펙<ol type="a"><li>2,304*960px, Png</li></ol></li>';
  html += '<li>자료<ol type="a"><li>URL 또는 MAS 위치</li></ol></li>';
  html += '<li>공유, 요청<ol type="a"><li>소속사 요청 사항 등을 편하게 남겨주세요!</li></ol></li>';
  html += "</ol>";
  return html;
}

function vmdItemsSpaceGangnam(): string {
  const items: { name: string; spec: string; vendor: string; vendorUrl?: string }[] = [
    {
      name: "현수막",
      spec: "3,700*2,100mm, PDF",
      vendor: "실사박사",
      vendorUrl: "https://1644-7484.com/shop/item.php?it_id=1572573668"
    },
    {
      name: "포스터 {n}종",
      spec: "424*598mm *양면, PDF",
      vendor: "레드프린팅",
      vendorUrl: "https://www.redprinting.co.kr/ko/product/item/PR/PRPOXXX"
    },
    { name: "매장 폼보드 {n}종", spec: "424*598mm, PDF", vendor: "팀원" },
    { name: "아티스트 로고 폼보드 1종", spec: "1,000*비율을 따름 mm, PDF", vendor: "팀원" },
    { name: "앨범 로고 폼보드 1종", spec: "1,000*비율을 따름 mm, PDF", vendor: "팀원" },
    { name: "X 배너 {n}종", spec: "600*1,800mm, PDF", vendor: "알파프린트" }
  ];

  let html = "";
  for (const item of items) {
    const vendorText = item.vendorUrl
      ? `<a href="${esc(item.vendorUrl)}">${esc(item.vendor)}</a>`
      : esc(item.vendor);
    html += `\n\n<strong>${esc(item.name)}</strong><ol>`;
    html += `<li>스펙<ol type="a"><li>${esc(item.spec)}</li></ol></li>`;
    html += `<li>발주처<ol type="a"><li>${vendorText}</li></ol></li>`;
    html += '<li>자료<ol type="a"><li>URL 또는 MAS 위치</li></ol></li>';
    html += '<li>공유, 요청<ol type="a"><li>소속사 요청 사항 등을 편하게 남겨주세요!</li></ol></li>';
    html += "</ol>";
  }
  return html;
}

function vmdItemsSpaceShanghai(): string {
  const items: { name: string; spec: string; note?: string }[] = [
    { name: "입구 디스플레이 1종", spec: "3,200*1,344px, Png" },
    { name: "중형 디스플레이 {n}종", spec: "1,080*1,920px, Png" },
    { name: "대형 디스플레이 1종", spec: "2,160*3,840px, Png" },
    { name: "곡면형 디스플레이 2종", spec: "2,080*1,248px, Png", note: "1,040*624px를 2배 크기로" },
    { name: "가운데 포스터 1종", spec: "1,460*2,400mm 도련 2mm, Pdf" }
  ];

  let html = "";
  for (const item of items) {
    html += `\n\n<strong>${esc(item.name)}</strong><ol>`;
    const specText = item.note ? `${esc(item.spec)} (비고: ${esc(item.note)})` : esc(item.spec);
    html += `<li>스펙<ol type="a"><li>${specText}</li></ol></li>`;
    html += '<li>자료<ol type="a"><li>URL 또는 MAS 위치</li></ol></li>';
    html += '<li>공유, 요청<ol type="a"><li>소속사 요청 사항 등을 편하게 남겨주세요!</li></ol></li>';
    html += "</ol>";
  }
  return html;
}

function vmdItemsSpaceGuangzhou(): string {
  const items: { name: string; spec: string }[] = [
    { name: "입구 디스플레이 1종", spec: "2,560*2,560px, Png" },
    { name: "가운데 포스터 1종", spec: "900*2,200mm 도련 2mm, Pdf" }
  ];

  let html = "";
  for (const item of items) {
    html += `\n\n<strong>${esc(item.name)}</strong><ol>`;
    html += `<li>스펙<ol type="a"><li>${esc(item.spec)}</li></ol></li>`;
    html += '<li>자료<ol type="a"><li>URL 또는 MAS 위치</li></ol></li>';
    html += '<li>공유, 요청<ol type="a"><li>소속사 요청 사항 등을 편하게 남겨주세요!</li></ol></li>';
    html += "</ol>";
  }
  return html;
}

function vmdItemsSpaceShenzhen(): string {
  const items: { name: string; spec: string }[] = [
    { name: "입구 디스플레이 1종", spec: "2,240*2,240px, Png" },
    { name: "가운데 디스플레이 1종", spec: "1,920*1,440px, Png" },
    { name: "가운데 포스터 {n}종", spec: "1,200*2,200mm, Pdf" }
  ];

  let html = "";
  for (const item of items) {
    html += `\n\n<strong>${esc(item.name)}</strong><ol>`;
    html += `<li>스펙<ol type="a"><li>${esc(item.spec)}</li></ol></li>`;
    html += '<li>자료<ol type="a"><li>URL 또는 MAS 위치</li></ol></li>';
    html += '<li>공유, 요청<ol type="a"><li>소속사 요청 사항 등을 편하게 남겨주세요!</li></ol></li>';
    html += "</ol>";
  }
  return html;
}
