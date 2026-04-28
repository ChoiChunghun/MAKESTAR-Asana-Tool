"use client";

import type { ReactNode } from "react";
import type { ParsedPlanSummary } from "@/types/parser";

type Props = {
  summary: ParsedPlanSummary;
};

/** YYYY-MM-DD → YYYY.MM.DD */
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10).replace(/-/g, ".");
}

/** 항목 목록을 줄바꿈으로 표시 */
function multiLine(items: string[], emptyText = "(없음)"): ReactNode {
  if (!items.length) return <span className="text-ms-faint">{emptyText}</span>;
  return (
    <>
      {items.map((item, i) => (
        <span key={i} className="block">{item}</span>
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

  // 응모 기간
  const startFmt = fmtDate(summary.applicationStartIso);
  const endFmt = fmtDate(summary.deadlineIso);
  const appPeriod =
    startFmt && endFmt ? `${startFmt} ~ ${endFmt}` :
    endFmt || startFmt || "(파악 불가)";

  // 당첨자 발표일
  const winnerFmt = fmtDate(summary.winnerAnnouncementIso) || "(파악 불가)";

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
            <span className="text-white text-sm font-medium">{value}</span>
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
