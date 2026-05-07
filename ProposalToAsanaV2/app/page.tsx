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

/** .docx 파일을 브라우저에서 텍스트만 추출 (이미지 제외 → 대용량 우회) */
async function extractDocxTextInBrowser(file: File): Promise<string> {
  // layout.tsx의 Script 태그로 로드된 window.mammoth 사용
  const mammoth = (window as unknown as {
    mammoth?: { extractRawText: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> }
  }).mammoth;

  if (!mammoth) {
    // 아직 스크립트 로드 전이면 잠시 대기 후 재시도
    await new Promise<void>((resolve, reject) => {
      let tries = 0;
      const MAX_TRIES = 100; // 10초 (100ms * 100)
      const check = setInterval(() => {
        if ((window as unknown as { mammoth?: unknown }).mammoth) {
          clearInterval(check);
          resolve();
        } else if (++tries > MAX_TRIES) {
          clearInterval(check);
          reject(new Error("문서 파싱 라이브러리 로드에 실패했습니다. 페이지를 새로 고침 후 다시 시도해주세요."));
        }
      }, 100);
    });
  }

  const m = (window as unknown as {
    mammoth: { extractRawText: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> }
  }).mammoth;

  const arrayBuffer = await file.arrayBuffer();
  const result = await m.extractRawText({ arrayBuffer });
  return result.value;
}

const HISTORY_KEY = "proposal2asana_history";
const TOKEN_KEY = "proposal2asana_token";
const ADMIN_CONFIG_KEY = "proposal2asana_admin_config";
const MAX_HISTORY = 5;

type Step = "idle" | "parsing" | "preview" | "creating" | "done";

type DerivativeInfo = {
  sectionGid: string;
  sectionName: string;
  suffix: "_CN" | "_NAEU";
};

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

  const [derivativeInfo, setDerivativeInfo] = useState<DerivativeInfo | null>(null);
  const [derivativeChecking, setDerivativeChecking] = useState(false);

  const fileInputKey = useRef(0);

  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (saved) setToken(saved);
    const hist = localStorage.getItem(HISTORY_KEY);
    if (hist) {
      try { setHistory(JSON.parse(hist)); } catch { localStorage.removeItem(HISTORY_KEY); }
    }
    // 서버에 저장된 관리자 설정을 불러와 로컬 디폴트로 병합
    fetch("/api/admin/config")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { config?: Record<string, unknown> } | null) => {
        if (data?.config) {
          const local = localStorage.getItem(ADMIN_CONFIG_KEY);
          const localObj = local ? JSON.parse(local) : {};
          // 서버 설정을 기본, 로컬 설정이 덮어씀 (사용자 커스텀 우선)
          const merged = { ...data.config, ...localObj };
          localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(merged));
        }
      })
      .catch(() => { /* KV 미설정 환경에서는 무시 */ });
  }, []);

  useEffect(() => {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
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

  async function checkDerivativeMode(pgid: string, prodCode: string, tok: string) {
    if (!pgid || !prodCode || !tok || prodCode.includes("추후 일괄 변경")) {
      setDerivativeInfo(null);
      return;
    }
    setDerivativeChecking(true);
    try {
      const res = await fetch(
        `/api/asana/check-derivative?projectGid=${encodeURIComponent(pgid)}&productCode=${encodeURIComponent(prodCode)}`,
        { headers: { "x-asana-token": tok } }
      );
      const data = await res.json();
      if (data.isDerivative) {
        setDerivativeInfo({ sectionGid: data.sectionGid, sectionName: data.sectionName, suffix: data.suffix });
      } else {
        setDerivativeInfo(null);
      }
    } catch {
      setDerivativeInfo(null);
    } finally {
      setDerivativeChecking(false);
    }
  }

  async function handleFileSelected(file: File) {
    setSelectedFile(file.name);
    setStep("parsing");
    setErrorMsg("");
    setPlan(null);
    setDerivativeInfo(null);

    try {
      const isDocx = file.name.toLowerCase().endsWith(".docx");
      let res: Response;

      if (isDocx) {
        // .docx: 브라우저에서 텍스트만 추출 → JSON으로 전송 (이미지 포함 대용량 파일 우회)
        const rawText = await extractDocxTextInBrowser(file);
        res = await fetch("/api/parse-document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText, fileName: file.name })
        });
      } else {
        // .pdf: 서버에서 파싱 (바이너리 전송)
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch("/api/parse-document", { method: "POST", body: formData });
      }

      const data = await safeJson(res, "파싱 중 오류가 발생했습니다.") as ParsedPlanResult & { message?: string };
      if (!res.ok) throw new Error(data.message);
      applyParseResult(data);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "파싱 중 오류가 발생했습니다.");
      setStep("idle");
    }
  }

  async function handleGoogleDocUrl(url: string) {
    // URL 형식을 먼저 검증 — 유효하지 않으면 step 변경 없이 오류만 표시
    const isValidGoogleDocUrl = /^https:\/\/docs\.google\.com\/document\/d\/[a-zA-Z0-9_-]+/.test(url);
    if (!isValidGoogleDocUrl) {
      setErrorMsg("올바른 Google Doc URL을 입력해주세요. (https://docs.google.com/...)");
      return;
    }

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
    // 프로젝트가 이미 선택된 경우 파생 모드 자동 확인
    if (token && projectGid) {
      checkDerivativeMode(projectGid, data.summary.productCode ?? "", token);
    }
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
    // 상품코드 변경 → 파생 모드 재확인
    if (token && projectGid) checkDerivativeMode(projectGid, code, token);
  }

  async function handleCreate() {
    if (!token || !projectGid || !plan) return;

    // ── 해외 단독 프로젝트: 당첨자 선정 팝업 ───────────────────────────────
    let effectiveRows = rows;
    const selectedProjectName = projects.find((p) => p.gid === projectGid)?.name ?? "";
    const isHaewaeProject = selectedProjectName.includes("해외 단독");
    const winnerRow = rows.find((r) => r.key === "winner");
    if (isHaewaeProject && winnerRow?.enabled && !derivativeInfo) {
      const skip = window.confirm(
        "선택하신 프로젝트는 「해외 단독」 프로젝트입니다.\n당첨자 선정 태스크를 만들지 않을까요?"
      );
      if (skip) {
        effectiveRows = rows.map((r) => r.key === "winner" ? { ...r, enabled: false } : r);
        setRows(effectiveRows);
      }
    }

    setStep("creating");
    setErrorMsg("");

    try {
      const res = await fetch("/api/asana/create-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asanaToken: token,
          projectGid,
          projectName: projects.find((p) => p.gid === projectGid)?.name ?? projectGid,
          sectionName,
          plan,
          rows: effectiveRows,
          ...(() => {
            try {
              const cfg = JSON.parse(localStorage.getItem(ADMIN_CONFIG_KEY) || "{}");
              return {
                designerGid: cfg.designerGid || "",
                followerGids: cfg.followerGids || [],
                productRegFollowerGids: cfg.productRegFollowerGids || [],
                artistDesignerMap: cfg.artistDesignerRules || []
              };
            } catch { return { designerGid: "", followerGids: [], productRegFollowerGids: [], artistDesignerMap: [] }; }
          })(),
          ...(derivativeInfo
            ? { derivative: { sectionGid: derivativeInfo.sectionGid, suffix: derivativeInfo.suffix } }
            : {})
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

  // 탭 닫기 / 브라우저 뒤로가기 시 경고
  useEffect(() => {
    const dirty = step === "preview" || step === "creating";
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [step]);

  function handleHomeClick() {
    if (step === "preview" || step === "creating") {
      if (!window.confirm("작업 중인 내용이 저장되지 않습니다.\n홈으로 이동하시겠습니까?")) return;
    }
    reset();
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
    setDerivativeInfo(null);
  }

  const hasDefaultCode = rows.some((r) => r.title?.includes("추후 일괄 변경"));
  const canCreate = token && projectGid && plan && rows.some((r) => r.enabled && r.available);

  return (
    <div className="min-h-screen bg-ms-bg text-ms-text flex flex-col">
      <header className="border-b border-ms-border bg-ms-canvas">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleHomeClick}
              className="text-ms-text font-bold text-lg leading-none hover:text-ms-gold transition-colors"
            >
              MAKESTAR 태스크 머신
            </button>
            <div className="flex items-center gap-1">
              <span className="text-ms-gold text-xs font-semibold tracking-wide">v0.88.3</span>
              <span className="text-ms-faint text-xs">·</span>
              <span className="text-ms-muted text-xs">Beta</span>
            </div>
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
              className="text-ms-muted hover:text-ms-text text-xs transition-colors"
            >
              Asana 토큰 발급 방법 문의
            </a>
            <a href="https://makestar.slack.com/team/UP1P34AUB" target="_blank" rel="noopener noreferrer" className="text-ms-muted hover:text-ms-text text-xs transition-colors">
              문의, 제보하기
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-6">
        {step === "done" ? (
          <div className="card text-center py-12">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-ms-text mb-2">생성 완료!</h2>
            <p className="text-ms-muted mb-6">
              총 <strong className="text-ms-text">{createdCount}개</strong>의 태스크가 생성되었습니다.
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
                  <h2 className="text-2xl font-bold text-ms-text mb-2">아사나 태스크 생성기</h2>
                  <p className="text-ms-muted">
                    Word, PDF, <s>Google Doc</s>{" "}
                    <span className="text-ms-accent text-xs font-medium">[보안 : Beta에서 제외]</span>
                    을 업로드하면 해당 이벤트의 모든 태스크를 일괄 생성합니다.
                    <br />
                    <span className="text-ms-accent text-xs">* Asana 토큰 입력 후 사용 가능</span>
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
                <p className="text-ms-text font-medium">파싱 중...</p>
                <p className="text-ms-muted text-sm mt-1">{selectedFile}</p>
              </div>
            )}

            {(step === "preview" || step === "creating") && plan && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-ms-muted">
                    <span className="dot-green">●</span>
                    파싱 완료: <strong className="text-ms-text">{selectedFile}</strong>
                  </div>
                  <button type="button" onClick={handleHomeClick} className="text-ms-muted hover:text-ms-text text-sm">
                    ← 처음으로
                  </button>
                </div>

                {/* 상품코드 일괄 수정 */}
                <div className="card">
                  <div className="ms-label">
                    <h2 className="text-sm font-semibold text-ms-text">상품코드</h2>
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
                    상품코드 입력 후 &quot;일괄 적용&quot;을 누르면 해당 이벤트의 모든 태스크명과 섹션명에 반영됩니다.
                  </p>
                </div>

                <ParseSummary summary={plan.summary} />

                <TaskPreviewTable
                  rows={rows}
                  sectionName={sectionName}
                  onRowsChange={setRows}
                  onSectionNameChange={setSectionName}
                />

                {/* 파생 모드 배너 */}
                {derivativeChecking && (
                  <div className="bg-ms-panel border border-ms-border rounded-xl px-4 py-2 text-ms-muted text-sm">
                    파생 모드 확인 중...
                  </div>
                )}
                {!derivativeChecking && derivativeInfo && (
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 text-orange-300 text-sm space-y-1">
                    <p className="font-semibold">⚠ 파생 모드 감지됨</p>
                    <p>
                      기존 섹션 <strong className="text-orange-200">&quot;{derivativeInfo.sectionName}&quot;</strong>에 태스크가 추가됩니다.
                    </p>
                    <p>
                      상품코드에 <strong className="text-orange-200">{derivativeInfo.suffix}</strong> 접미사가 자동 적용되고,
                      태스크 유형이 <strong className="text-orange-200">SNS 오픈</strong>으로,
                      이벤트 구분이 <strong className="text-orange-200">파생</strong>으로 고정됩니다.
                    </p>
                  </div>
                )}

                {/* 프로젝트 선택 + 생성 */}
                <div className="card">
                  <div className="ms-label mb-3">
                    <h2 className="text-sm font-semibold text-ms-text">Asana 프로젝트 선택</h2>
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
                          onChange={(e) => {
                            setProjectGid(e.target.value);
                            if (plan && token) {
                              const code = productCodeOverride.trim() || plan.summary.productCode;
                              checkDerivativeMode(e.target.value, code, token);
                            }
                          }}
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
                            inputMode="numeric"
                            pattern="\d{10,}"
                            value={projectGid}
                            onChange={(e) => setProjectGid(e.target.value.replace(/\D/g, ""))}
                            placeholder="프로젝트 GID (숫자만)"
                            className="ms-input flex-1 font-mono"
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
      <footer className="border-t border-ms-border mt-auto bg-ms-panel">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-center gap-4">
          <p className="text-ms-faint text-xs">
            © 2026 MAKESTAR Inc. All Rights Reserved.
          </p>
          <a
            href="/admin"
            className="text-[10px] font-bold"
            style={{ color: "#E6B800" }}
          >
            관리자
          </a>
        </div>
      </footer>
    </div>
  );
}
