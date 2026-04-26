"use client";

import type { ParsedPlanSummary } from "@/types/parser";

type Props = {
  summary: ParsedPlanSummary;
};

export function ParseSummary({ summary }: Props) {
  if (!summary) return null;

  const eventLabels = summary.eventLabels ?? [];
  const photocards = summary.photocards ?? [];
  const benefits = summary.benefits ?? [];
  const snsItems = summary.snsItems ?? [];

  const rows: [string, string][] = [
    ["아티스트", summary.artistName || "(파악 불가)"],
    ["앨범", summary.albumName || "(파악 불가)"],
    ["이벤트명", summary.eventTitle || "(파악 불가)"],
    ["이벤트 구분", eventLabels.length ? eventLabels.join(", ") : "(파악 불가)"],
    ["응모 마감일", summary.deadlineIso || "(파악 불가)"],
    ["당첨자 발표일", summary.winnerAnnouncementIso || "(파악 불가)"],
    ["포토카드", photocards.length ? `${photocards.length}종 총 ${summary.photocardTotal}매` : "(없음)"],
    ["특전", benefits.length ? `${benefits.length}종 총 ${summary.benefitTotal}개` : "(없음)"],
    ["스토리 수", `${summary.storyCount ?? 0}종`],
    ["SNS 항목", snsItems.join(", ") || "(없음)"],
    ["VMD 생성", summary.createVmdTask ? "✓ 생성" : "✗ 미생성"],
    ["당첨자 선정", summary.createWinnerAnnouncementTask ? "✓ 생성" : "✗ 미생성"]
  ];

  return (
    <div className="card">
      <p className="ms-section-title mb-3">파싱 요약</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-3 py-2 border-b border-ms-border/50 last:border-0">
            <span className="text-ms-muted text-sm w-28 shrink-0">{label}</span>
            <span className="text-white text-sm font-medium">{value}</span>
          </div>
        ))}
      </div>

      {photocards.length > 0 && (
        <div className="mt-4">
          <p className="ms-hint mb-2">포토카드 상세</p>
          <div className="flex flex-wrap gap-1.5">
            {photocards.map((pc) => (
              <span key={pc.name} className="ms-tag ms-tag-accent">
                {pc.name} {pc.count}종
              </span>
            ))}
          </div>
        </div>
      )}

      {benefits.length > 0 && (
        <div className="mt-3">
          <p className="ms-hint mb-2">특전 상세</p>
          <div className="flex flex-wrap gap-1.5">
            {benefits.map((b) => (
              <span key={b.name} className="ms-tag">
                {b.name} {b.count}개
              </span>
            ))}
          </div>
        </div>
      )}

      {summary.dueSummary && (
        <div className="mt-4 p-3 bg-ms-subtle rounded-lg">
          <p className="ms-hint mb-1">마감일 계산</p>
          <pre className="text-ms-text text-xs whitespace-pre-wrap font-mono">{summary.dueSummary.text}</pre>
        </div>
      )}
    </div>
  );
}
