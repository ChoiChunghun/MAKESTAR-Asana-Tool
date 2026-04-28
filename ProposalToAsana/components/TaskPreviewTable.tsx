"use client";

import type { PreviewTaskRow, TaskKey } from "@/types/parser";

type TaskPreviewTableProps = {
  rows: PreviewTaskRow[];
  onRowsChange: (rows: PreviewTaskRow[]) => void;
};

export function TaskPreviewTable({ rows, onRowsChange }: TaskPreviewTableProps) {
  function isParentEnabled(row: PreviewTaskRow): boolean {
    if (!row.parentKey) return true;
    const parent = rows.find((item) => item.key === row.parentKey);
    return Boolean(parent?.enabled && parent.available);
  }

  function toggleRow(key: TaskKey, enabled: boolean) {
    const current = rows.find((row) => row.key === key);
    const nextRows = rows.map((row) => {
      if (row.key === key) {
        return { ...row, enabled: row.available ? enabled : false };
      }
      if (current?.isParent && row.parentKey === key) {
        return { ...row, enabled: enabled && row.available };
      }
      return row;
    });
    onRowsChange(nextRows);
  }

  function updateTitle(key: TaskKey, title: string) {
    onRowsChange(rows.map((row) => (row.key === key ? { ...row, title } : row)));
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>생성 예정 태스크 미리보기</h2>
      </div>
      <div className="task-table-wrap">
        <table className="task-table">
          <thead>
            <tr>
              <th>생성</th>
              <th>태스크</th>
              <th>태스크 제목</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const parentEnabled = isParentEnabled(row);
              const effectiveEnabled = row.available && row.enabled && parentEnabled;
              const disabled = !row.available || !parentEnabled;

              return (
                <tr key={row.key} className={effectiveEnabled ? undefined : "row-muted"}>
                  <td>
                    <input
                      type="checkbox"
                      checked={effectiveEnabled}
                      disabled={disabled}
                      onChange={(event) => toggleRow(row.key, event.target.checked)}
                      aria-label={`${row.label} 생성 여부`}
                    />
                  </td>
                  <td>
                    <div className={`task-label ${row.indent ? "child" : ""}`}>{row.label}</div>
                    {!row.available && row.unavailableReason ? <span className="reason">{row.unavailableReason}</span> : null}
                  </td>
                  <td>
                    <input
                      className="task-title-input"
                      value={row.title}
                      disabled={disabled || !effectiveEnabled}
                      onChange={(event) => updateTitle(row.key, event.target.value)}
                    />
                  </td>
                  <td>{effectiveEnabled ? "생성 예정" : "생성 안 함"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
