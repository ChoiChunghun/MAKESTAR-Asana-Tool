"use client";

import { useState } from "react";
import type { ParsedPlanSummary } from "@/types/parser";

export type HistoryEntry = {
  id: string;
  createdAt: string;
  sectionName: string;
  summary: ParsedPlanSummary;
  projectGid: string;
  projectName: string;
  productCode?: string;
  /** Asana 섹션 GID — 이름 변경 시 사용 */
  sectionGid?: string;
  /** 생성된 태스크 목록 — 이름 변경 시 사용 */
  createdTasks?: { gid: string; name: string }[];
};

const TOKEN_KEY = "proposal2asana_token";

type Props = {
  history: HistoryEntry[];
  onClear: () => void;
  onUpdateEntry?: (id: string, productCode: string, updatedTasks?: { gid: string; name: string }[], newSectionName?: string) => void;
  token?: string;
};

export function EventHistory({ history, onClear, onUpdateEntry, token }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  if (history.length === 0) return null;

  function startEdit(entry: HistoryEntry) {
    setEditingId(entry.id);
    setEditValue(entry.productCode ?? entry.summary.productCode ?? "");
    setErrorId(null);
  }

  async function commitEdit(entry: HistoryEntry) {
    const newCode = editValue.trim();
    setEditingId(null);
    if (!newCode) return;

    const oldCode = entry.productCode ?? entry.summary.productCode ?? "";
    if (newCode === oldCode) return;

    // Asana 이름 변경 시도
    if (entry.sectionGid || (entry.createdTasks?.length ?? 0) > 0) {
      const tok = token || (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null) || "";
      if (!tok) {
        setErrorId(entry.id);
        setErrorMsg("상단에서 Asana 토큰을 먼저 입력해주세요.");
        return;
      }

      setRenaming(entry.id);
      try {
        const newSectionName = entry.sectionName.replaceAll(oldCode, newCode);
        const updatedTasks = (entry.createdTasks ?? []).map((t) => {
          // 섹션명 전체가 태스크명에 포함된 경우 먼저 치환, 그 다음 상품코드 단독 치환
          let name = t.name.replaceAll(entry.sectionName, newSectionName);
          name = name.replaceAll(oldCode, newCode);
          return { gid: t.gid, name };
        });

        const res = await fetch("/api/asana/rename-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asanaToken: tok,
            sectionGid: entry.sectionGid,
            newSectionName,
            tasks: updatedTasks
          })
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorId(entry.id);
          setErrorMsg(data.message || "이름 변경에 실패했습니다.");
          return;
        }

        // 성공: 로컬 상태에도 새 이름 반영
        onUpdateEntry?.(entry.id, newCode, updatedTasks, newSectionName);
      } catch {
        setErrorId(entry.id);
        setErrorMsg("이름 변경 중 오류가 발생했습니다.");
      } finally {
        setRenaming(null);
      }
    } else {
      // sectionGid 없으면 로컬만 업데이트
      onUpdateEntry?.(entry.id, newCode);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <p className="ms-section-title">최근 생성 이력 (최대 5개)</p>
        <button
          type="button"
          onClick={onClear}
          className="text-ms-faint hover:text-ms-muted text-xs"
        >
          전체 삭제
        </button>
      </div>

      <div className="space-y-2">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start justify-between p-3 rounded-lg bg-ms-bg border border-ms-border/50"
          >
            <div className="min-w-0 flex-1">
              <p className="text-ms-text text-sm font-medium truncate">{entry.sectionName}</p>

              {/* 상품코드 인라인 편집 */}
              <div className="flex items-center gap-1.5 mt-1">
                {editingId === entry.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitEdit(entry)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit(entry);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="ms-input text-xs py-0.5 px-1.5 h-6 w-44"
                  />
                ) : renaming === entry.id ? (
                  <span className="text-ms-faint text-xs flex items-center gap-1">
                    <span className="spinner-sm" />
                    변경 중...
                  </span>
                ) : (
                  <button
                    type="button"
                    title="클릭하여 상품코드 수정 (Asana에도 반영됩니다)"
                    onClick={() => startEdit(entry)}
                    className="flex items-center gap-1.5 text-xs text-left group"
                  >
                    <span className="text-ms-muted group-hover:text-ms-text truncate max-w-[140px]">
                      {entry.productCode ?? entry.summary.productCode ?? "—"}
                    </span>
                    <span className="text-ms-accent shrink-0">[상품 코드 변경]</span>
                  </button>
                )}
                <span className="text-ms-faint text-xs">·</span>
                <span className="text-ms-muted text-xs truncate">
                  {entry.summary.eventLabels.join(", ")}
                </span>
              </div>

              {/* 오류 메시지 */}
              {errorId === entry.id && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <span>⚠</span>
                  <span>{errorMsg} 디자인센터(최충훈)에게 문의하세요.</span>
                  <button
                    type="button"
                    onClick={() => setErrorId(null)}
                    className="ml-1 text-ms-faint hover:text-ms-text"
                  >
                    ×
                  </button>
                </p>
              )}

              <p className="text-ms-faint text-xs mt-0.5">
                {entry.projectName} ·{" "}
                {new Date(entry.createdAt).toLocaleString("ko-KR", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </p>
            </div>
            <a
              href={`https://app.asana.com/0/${entry.projectGid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-3 text-ms-accent text-xs hover:underline shrink-0 mt-0.5"
            >
              Asana →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
