"use client";

import { useEffect, useRef, useState } from "react";
import type { AsanaProject } from "@/types/asana";
import type { ParsedPlanResult, PreviewTaskRow } from "@/types/parser";
import { DocumentUpload } from "@/components/upload/DocumentUpload";
import { TokenInput } from "@/components/layout/TokenInput";
import { ParseSummary } from "@/components/preview/ParseSummary";
import { TaskPreviewTable } from "@/components/preview/TaskPreviewTable";
import { EventHistory, type HistoryEntry } from "@/components/layout/EventHistory";

/** JSON 파싱 실패 시 (413 등 비JSON 응답) 안전하게 에러를 던짐 */
async function safeJson(res: Response, fallback: string): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (res.status === 413) throw new Error("파일 크기가 너무 큽니다. 20MB 이하의 파일을 업로드해주세요.");
    throw new Error(text.slice(0, 200) || fallback);
  }
}

const HISTORY_KEY = "proposal2asana_history";
const TOKEN_KEY = "proposal2asana_token";
const ADMIN_CONFIG_KEY = "proposal2asana_admin_config";
const MAX_HISTORY = 5;

type Step = "idle" | "parsing" | "preview" | "creating" | "done";

export default function HomePage() {
  const [token, setToken] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedFile, setSelectedFile] = useState<string>("");

  const [plan, setPlan] = useState<ParsedPlanResult | null>(null);
  const [rows, setRows] = useState<PreviewTaskRow[]>([]);
  const [sectionName, setSectionName] = useState("");
  const [productCodeOverride, setProductCodeOverride] = useState("");

  const [projects, setProjects] = useState<AsanaProject[]>([]);
  const [projectGid, setProjectGid] = useState("");
  const [projectsLoading, setProjectsLoading] = useState(false);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [doneUrl, setDoneUrl] = useState("");
  const [createdCount, setCreatedCount] = useState(0);

  const fileInputKey = useRef(0);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) setToken(saved);
    const hist = localStorage.getItem(HISTORY_KEY);
    if (hist) setHistory(JSON.parse(hist));
  }, []);

  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  async function loadProjects(tok: string) {
    if (!tok) return;
    setProjectsLoading(true);
    try {
      const res = await fetch("/api/asana/projects", {
        headers: { "x-asana-token": tok }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setProjects(data.projects || []);
      if (data.projects?.[0]) setProjectGid(data.projects[0].gid);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "프로젝트를 불러오지 못했습니다.");
    } finally {
      setProjectsLoading(false);
    }
  }

  async function handleFileSelected(file: File) {
    setSelectedFile(file.name);
    setStep("parsing");
    setErrorMsg("");
    setPlan(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/parse-document", { method: "POST", body: formData });
      const data = await safeJson(res, "파싱 중 오류가 발생했습니다.") as ParsedPlanResult & { message?: string };
      if (!res.ok) throw new Error(data.message);
      applyParseResult(data);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "파싱 중 오류가 발생했습니다.");
      setStep("idle");
    }
  }

  async function handleGoogleDocUrl(url: string) {
    setSelectedFile("Google Doc");
    setStep("parsing");
    setErrorMsg("");
    setPlan(null);

    try {
      const res = await fetch("/api/parse-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleDocUrl: url })
      });
      const data = await safeJson(res, "Google Doc 파싱 중 오류가 발생했습니다.") as ParsedPlanResult & { message?: string };
      if (!res.ok) throw new Error(data.message);
      applyParseResult(data);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Google Doc 파싱 중 오류가 발생했습니다.");
      setStep("idle");
    }
  }

  function applyParseResult(data: ParsedPlanResult) {
    if (!data || !data.summary || !data.previewRows) {
      setErrorMsg("서버에서 올바른 파싱 결과를 받지 못했습니다. 다시 시도해주세요.");
      setStep("idle");
      return;
    }
    setPlan(data);
    setRows(data.previewRows);
    setSectionName(data.summary.sectionName ?? "");
    setProductCodeOverride(data.summary.productCode ?? "");
    setStep("preview");
    if (token && projects.length === 0) loadProjects(token);
  }

  function applyProductCodeOverride() {
    if (!plan || !productCodeOverride.trim()) return;
    const code = productCodeOverride.trim();
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        title: r.title.replace(/^\[.*?\]/, `[${code}]`)
      }))
    );
    setSectionName((prev) => {
      const parts = prev.split(" ");
      if (parts.length >= 2) return `${parts[0]} ${code}`;
      return `${prev} ${code}`;
    });
  }

  async function handleCreate() {
    if (!token || !projectGid || !plan) return;
    setStep("creating");
    setErrorMsg("");

    try {
      const res = await fetch("/api/asana/create-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asanaToken: token,
          projectGid,
          sectionName,
          plan,
          rows,
          ...(() => {
            try {
              const cfg = JSON.parse(localStorage.getItem(ADMIN_CONFIG_KEY) || "{}");
              return {
                designerGid: cfg.designerGid || "",
                followerGids: cfg.followerGids || [],
                artistDesignerMap: cfg.artistDesignerRules || []
              };
            } catch { return { designerGid: "", followerGids: [], artistDesignerMap: [] }; }
          })()
        })
      });
      const raw = await safeJson(res, "Asana 태스크 생성 중 오류가 발생했습니다.") as {
        message?: string; projectUrl?: string; sectionGid?: string;
        createdTasks?: { gid: string; name: string }[];
      };
      if (!res.ok) throw new Error(raw.message);

      setDoneUrl(raw.projectUrl ?? "");
      setCreatedCount(raw.createdTasks?.length || 0);
      setStep("done");

      const projectName = projects.find((p) => p.gid === projectGid)?.name || projectGid;
      const newEntry: HistoryEntry = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        sectionName,
        summary: plan.summary,
        projectGid,
        projectName,
        productCode: productCodeOverride.trim() || plan.summary.productCode,
        sectionGid: raw.sectionGid,
        createdTasks: raw.createdTasks?.map((t) => ({ gid: t.gid, name: t.name }))
      };
      const newHistory = [newEntry, ...history].slice(0, MAX_HISTORY);
      setHistory(newHistory);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Asana 태스크 생성 중 오류가 발생했습니다.");
      setStep("preview");
    }
  }

  function handleUpdateHistoryEntry(
    id: string,
    productCode: string,
    updatedTasks?: { gid: string; name: string }[],
    newSectionName?: string
  ) {
    setHistory((prev) => {
      const updated = prev.map((e) => {
        if (e.id !== id) return e;
        return {
          ...e,
          productCode,
          ...(newSectionName ? { sectionName: newSectionName } : {}),
          ...(updatedTasks ? { createdTasks: updatedTasks } : {})
        };
      });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  function reset() {
    fileInputKey.current++;
    setStep("idle");
    setPlan(null);
    setRows([]);
    setSectionName("");
    setErrorMsg("");
    setSelectedFile("");
    setDoneUrl("");
  }

  const canCreate = token && projectGid && plan && rows.some((r) => r.enabled && r.available);

  return (
    <div className="min-h-screen bg-ms-bg text-ms-text flex flex-col">
      <header className="border-b border-ms-border bg-ms-panel">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h1 className="text-white font-bold text-lg leading-none">MAKESTAR 태스크 머신</h1>
            <span className="text-ms-gold text-xs font-semibold tracking-wide">v2</span>
            <span className="text-ms-faint text-xs">·</span>
            <span className="text-ms-muted text-xs">Beta</span>
          </div>
          <div className="flex items-center gap-3">
            <TokenInput
              token={token}
              onTokenChange={(t) => {
                setToken(t);
                if (t.trim().length > 10) loadProjects(t);
              }}
            />
            <a
              href="https://developers.asana.com/docs/personal-access-token"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ms-muted hover:text-white text-sm transition-colors"
            >
              Asana 토큰 발급 방법
            </a>
            <a href="/admin" className="text-ms-muted hover:text-white text-sm transition-colors">
              관리자
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-6">
        {step === "done" ? (
          <div className="card text-center py-12">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-white mb-2">생성 완료!</h2>
            <p className="text-ms-muted mb-6">
              총 <strong className="text-white">{createdCount}개</strong>의 태스크가 생성되었습니다.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <a
                href={doneUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-accent px-6 py-2.5"
              >
                Asana에서 확인 →
              </a>
              <button type="button" onClick={() => setStep("preview")} className="btn px-6 py-2.5">
                ← 미리보기로
              </button>
              <button type="button" onClick={reset} className="btn px-6 py-2.5">
                새 기획서 처리
              </button>
            </div>
          </div>
        ) : (
          <>
            {step === "idle" && (
              <>
                <div className="text-center py-6">
                  <h2 className="text-2xl font-bold text-white mb-2">아사나 태스크 생성기</h2>
                  <p className="text-ms-muted">
                    PDF, Word, <s>Google Doc</s>을 업로드하면 해당 이벤트의 모든 태스크를 일괄 생성합니다.
                    <br />
                    <span className="text-ms-faint text-xs">* Asana 토큰 입력 후 사용 가능</span>
                  </p>
                </div>
                <DocumentUpload
                  disabled={step !== "idle"}
                  onFileSelected={handleFileSelected}
                  onGoogleDocUrl={handleGoogleDocUrl}
                />
                <EventHistory
                  history={history}
                  token={token}
                  onClear={() => {
                    setHistory([]);
                    localStorage.removeItem(HISTORY_KEY);
                  }}
                  onUpdateEntry={handleUpdateHistoryEntry}
                />
              </>
            )}

            {step === "parsing" && (
              <div className="card text-center py-16">
                <div className="spinner mx-auto mb-4" />
                <p className="text-white font-medium">파싱 중...</p>
                <p className="text-ms-muted text-sm mt-1">{selectedFile}</p>
              </div>
            )}

            {(step === "preview" || step === "creating") && plan && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-ms-muted">
                    <span className="dot-green">●</span>
                    파싱 완료: <strong className="text-white">{selectedFile}</strong>
                  </div>
                  <button type="button" onClick={reset} className="text-ms-muted hover:text-white text-sm">
                    ← 처음으로
                  </button>
                </div>

                {/* 상품코드 일괄 수정 */}
                <div className="card">
                  <div className="ms-label">
                    <h2 className="text-sm font-semibold text-white">상품코드 / 아티스트 코드</h2>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={productCodeOverride}
                      onChange={(e) => setProductCodeOverride(e.target.value)}
                      placeholder="상품코드 또는 아티스트명+코드"
                      className="ms-input flex-1"
                    />
                    <button
                      type="button"
                      onClick={applyProductCodeOverride}
                      className="btn"
                    >
                      일괄 적용
                    </button>
                  </div>
                  <p className="ms-hint">
                    입력 후 &quot;일괄 적용&quot;을 누르면 모든 태스크명과 섹션명에 반영됩니다.
                  </p>
                </div>

                <ParseSummary summary={plan.summary} />

                <TaskPreviewTable
                  rows={rows}
                  sectionName={sectionName}
                  onRowsChange={setRows}
                  onSectionNameChange={setSectionName}
                />

                {/* 프로젝트 선택 + 생성 */}
                <div className="card">
                  <div className="ms-label mb-3">
                    <h2 className="text-sm font-semibold text-white">Asana 프로젝트 선택</h2>
                  </div>
                  {!token && (
                    <p className="dot-yellow text-sm mb-3">⚠ 상단에서 Asana 토큰을 먼저 입력해주세요.</p>
                  )}
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      {projectsLoading ? (
                        <div className="text-ms-muted text-sm py-2">프로젝트 로딩 중...</div>
                      ) : projects.length > 0 ? (
                        <select
                          value={projectGid}
                          onChange={(e) => setProjectGid(e.target.value)}
                          className="ms-input"
                        >
                          {projects.map((p) => (
                            <option key={p.gid} value={p.gid}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={projectGid}
                            onChange={(e) => setProjectGid(e.target.value)}
                            placeholder="프로젝트 GID (숫자)"
                            className="ms-input flex-1"
                          />
                          <button
                            type="button"
                            disabled={!token}
                            onClick={() => loadProjects(token)}
                            className="btn"
                          >
                            불러오기
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!canCreate || step === "creating"}
                      onClick={handleCreate}
                      className="btn-accent px-6 py-2.5"
                    >
                      {step === "creating" ? (
                        <span className="flex items-center gap-2">
                          <span className="spinner-sm" />
                          생성 중...
                        </span>
                      ) : (
                        "생성하기"
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
                {errorMsg} 디자인센터(최충훈)에게 문의하세요.
              </div>
            )}
          </>
        )}
      </main>
      <footer className="border-t border-ms-border/20 mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-5 text-center">
          <p className="text-ms-faint text-xs">
            © 2026 MAKESTAR Inc. All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
