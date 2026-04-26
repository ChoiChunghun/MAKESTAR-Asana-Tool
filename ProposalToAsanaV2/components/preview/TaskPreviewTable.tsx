"use client";

import type { PreviewTaskRow, TaskKey } from "@/types/parser";

type Props = {
  rows: PreviewTaskRow[];
  sectionName: string;
  onRowsChange: (rows: PreviewTaskRow[]) => void;
  onSectionNameChange: (name: string) => void;
};

export function TaskPreviewTable({ rows, sectionName, onRowsChange, onSectionNameChange }: Props) {
  const safeRows = rows ?? [];

  function toggleRow(key: TaskKey) {
    const target = safeRows.find((r) => r.key === key);
    if (!target || !target.available) return;
    const newEnabled = !target.enabled;
    onRowsChange(
      safeRows.map((r) => {
        if (r.key === key) return { ...r, enabled: newEnabled };
        // 상위 토글 시 직계 하위 태스크도 함께 연동
        if (r.parentKey === key && r.available) return { ...r, enabled: newEnabled };
        return r;
      })
    );
  }

  function updateTitle(key: TaskKey, title: string) {
    onRowsChange(safeRows.map((r) => (r.key === key ? { ...r, title } : r)));
  }

  return (
    <div className="card">
      <p className="ms-section-title mb-3">태스크 미리보기</p>

      <div className="mb-4">
        <label className="ms-label">섹션명 (Asana 섹션)</label>
        <input
          type="text"
          value={sectionName}
          onChange={(e) => onSectionNameChange(e.target.value)}
          className="ms-input"
          placeholder="MM/DD 상품코드"
        />
        <p className="ms-hint">
          섹션명이 이미 존재하면 해당 섹션에 추가됩니다. 없으면 새로 생성됩니다.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ms-border">
              <th className="text-left py-2 pr-3 text-ms-muted font-medium w-8">생성</th>
              <th className="text-left py-2 pr-3 text-ms-muted font-medium w-28">구분</th>
              <th className="text-left py-2 text-ms-muted font-medium">태스크명</th>
            </tr>
          </thead>
          <tbody>
            {safeRows.map((row) => (
              <tr
                key={row.key}
                className={`border-b border-ms-border/30 ${
                  !row.available ? "opacity-40" : ""
                } ${row.isParent ? "bg-ms-subtle/30" : ""}`}
              >
                <td className="py-2 pr-3">
                  <input
                    type="checkbox"
                    checked={row.enabled && row.available}
                    disabled={!row.available}
                    onChange={() => toggleRow(row.key)}
                    className="accent-ms-accent cursor-pointer"
                  />
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={`text-xs ${
                      row.indent > 0 ? "text-ms-faint pl-4" : "text-ms-text font-medium"
                    }`}
                  >
                    {row.label}
                  </span>
                </td>
                <td className="py-2">
                  {row.available ? (
                    <input
                      type="text"
                      value={row.title}
                      onChange={(e) => updateTitle(row.key, e.target.value)}
                      disabled={!row.enabled}
                      className="w-full px-2 py-1 rounded-lg bg-ms-bg border border-ms-border/50 text-white text-xs focus:outline-none focus:border-ms-accent/70 disabled:opacity-50"
                    />
                  ) : (
                    <span className="text-ms-faint text-xs italic">{row.unavailableReason}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
