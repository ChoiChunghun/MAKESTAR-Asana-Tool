"use client";

import type { ReactNode } from "react";
import type { ParsedPlanSummary } from "@/types/parser";

type Props = {
  summary: ParsedPlanSummary;
};

/**
 * YYYY-MM-DD            → "YYYY.MM.DD"
 * YYYY-MM-DDTHH:MM      → "YYYY.MM.DD HH:MM KST"
 * appendKst=false 이면 KST 생략 (범위 표기에서 앞 부분에 사용)
 */
function fmtDateTime(iso: string | null | undefined, appendKst = true): string {
  if (!iso) return "";
  const dateStr = iso.slice(0, 10).replace(/-/g, ".");
  if (iso.length > 10 && iso[10] === "T") {
    const time = iso.slice(11, 16);
    return appendKst ? `${dateStr} ${time} KST` : `${dateStr} ${time}`;
  }
  return dateStr;
}

/** 항목 목록을 줄바꿈으로 표시 — "총 N종/매/개" 행은 볼드 처리 */
function multiLine(items: string[], emptyText = "(없음)"): ReactNode {
  if (!items.length) return <span className="text-ms-faint">{emptyText}</span>;
  return (
    <>
      {items.map((item, i) => (
        <span key={i} className={`block ${/^총\s*\d+/.test(item) ? "font-bold" : ""}`}>
          {item}
        </span>
      ))}
    </>
  );
}

export function ParseSummary({ summary }: Props) {
  if (!summary) return null;

  const eventLabels = summary.eventLabels ?? [];
  const photocards = summary.photocards ?? [];
  const benefits = summary.benefits ?? [];
  const snsItems = summary.snsItems ?? [];

  // 응모 기간 — 시간 있으면 "YYYY.MM.DD HH:MM - YYYY.MM.DD HH:MM KST"
  const startFmt = fmtDateTime(summary.applicationStartIso, false); // KST 생략 (앞부분)
  const endFmt   = fmtDateTime(summary.deadlineIso);                 // KST 포함 (뒷부분)
  const appPeriod =
    startFmt && endFmt ? `${startFmt} - ${endFmt}` :
    endFmt || startFmt || "(파악 불가)";

  // 당첨자 발표일 (날짜만, 시간 없음)
  const winnerFmt = fmtDateTime(summary.winnerAnnouncementIso) || "(파악 불가)";

  // 포토카드 줄별 표시
  const pcLines: string[] =
    photocards.length > 0
      ? [...photocards.map((pc) => `${pc.name}  ${pc.count}종`), `총 ${summary.photocardTotal}종`]
      : [];

  // 특전 줄별 표시
  const spLines: string[] =
    benefits.length > 0
      ? [...benefits.map((b) => `${b.name}  ${b.count}종`), `총 ${summary.benefitTotal}종`]
      : [];

  // VMD 생성 – 공간명 표기
  const vmdValue = summary.createVmdTask
    ? `✓ ${summary.venue || "생성"}`
    : "✗ 미생성";

  type SummaryRow = { label: string; value: ReactNode };

  const rows: SummaryRow[] = [
    { label: "아티스트",    value: summary.artistName  || "(파악 불가)" },
    { label: "앨범",        value: summary.albumName   || "(파악 불가)" },
    { label: "이벤트명",    value: summary.eventTitle  || "(파악 불가)" },
    { label: "이벤트 구분", value: eventLabels.length ? eventLabels.join(", ") : "(파악 불가)" },
    { label: "응모 기간",   value: appPeriod },
    { label: "당첨자 발표일", value: winnerFmt },
    { label: "포토카드",    value: multiLine(pcLines) },
    { label: "특전",        value: multiLine(spLines) },
    { label: "스토리 수",   value: `${summary.storyCount ?? 0}종` },
    { label: "SNS 항목",    value: multiLine(snsItems) },
    { label: "VMD 생성",    value: vmdValue },
    { label: "당첨자 선정", value: summary.createWinnerAnnouncementTask ? "✓ 생성" : "✗ 미생성" },
  ];

  return (
    <div className="card">
      <p className="ms-section-title mb-3">이벤트 요약</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex gap-3 py-2 border-b border-ms-border/50 last:border-0">
            <span className="text-ms-muted text-sm w-28 shrink-0">{label}</span>
            <span className="text-ms-text text-sm font-medium">{value}</span>
          </div>
        ))}
      </div>

      {summary.dueSummary && (
        <div className="mt-4 p-3 bg-ms-subtle rounded-lg">
          <p className="ms-hint mb-1">마감일 계산</p>
          <pre className="text-ms-text text-xs whitespace-pre-wrap font-mono">{summary.dueSummary.text}</pre>
        </div>
      )}
    </div>
  );
}
