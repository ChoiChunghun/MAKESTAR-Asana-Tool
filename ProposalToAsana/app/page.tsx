"use client";

import { useEffect, useMemo, useState } from "react";
import { CreateButton } from "@/components/CreateButton";
import { ParseSummary } from "@/components/ParseSummary";
import { PdfUpload } from "@/components/PdfUpload";
import { TaskPreviewTable } from "@/components/TaskPreviewTable";
import type { AsanaCreateTasksResponse, AsanaProject } from "@/types/asana";
import type { ParsedPlanResult, PreviewTaskRow } from "@/types/parser";

type ApiError = {
  message?: string;
};

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParsedPlanResult | null>(null);
  const [rows, setRows] = useState<PreviewTaskRow[]>([]);
  const [projects, setProjects] = useState<AsanaProject[]>([]);
  const [projectGid, setProjectGid] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [productCodeDraft, setProductCodeDraft] = useState("");
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [projectError, setProjectError] = useState("");
  const [success, setSuccess] = useState<AsanaCreateTasksResponse | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadProjects() {
      try {
        const response = await fetch("/api/asana/projects");
        const data = (await response.json()) as { projects?: AsanaProject[] } & ApiError;
        if (!response.ok) throw new Error(data.message || "프로젝트 목록을 불러오지 못했습니다.");
        if (ignore) return;
        setProjects(data.projects || []);
        setProjectGid(data.projects?.[0]?.gid || "");
      } catch (loadError) {
        if (!ignore) setProjectError(loadError instanceof Error ? loadError.message : "프로젝트 목록을 불러오지 못했습니다.");
      }
    }
    loadProjects();
    return () => {
      ignore = true;
    };
  }, []);

  const canCreate = useMemo(() => {
    return Boolean(parseResult && projectGid && sectionName.trim() && rows.some((row) => row.enabled && row.available));
  }, [parseResult, projectGid, rows, sectionName]);

  async function handleFileSelected(file: File) {
    setSelectedFile(file);
    setParseResult(null);
    setRows([]);
    setError("");
    setSuccess(null);
    setParsing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/parse-pdf", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as ParsedPlanResult & ApiError;
      if (!response.ok) throw new Error(data.message || "PDF 파싱에 실패했습니다.");

      setParseResult(data);
      setRows(data.previewRows);
      setSectionName(data.summary.sectionName);
      setProductCodeDraft(data.summary.productCodeDetected ? data.summary.productCode : "");
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "PDF 파싱 중 오류가 발생했습니다.");
    } finally {
      setParsing(false);
    }
  }

  async function handleCreate() {
    if (!parseResult) return;
    setCreating(true);
    setError("");
    setSuccess(null);

    try {
      const response = await fetch("/api/asana/create-tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          projectGid,
          sectionName,
          plan: parseResult,
          rows
        })
      });
      const data = (await response.json()) as AsanaCreateTasksResponse & ApiError;
      if (!response.ok) throw new Error(data.message || "Asana 태스크 생성에 실패했습니다.");
      setSuccess(data);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Asana 태스크 생성 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  }

  function handleApplyProductCode() {
    if (!parseResult) return;

    const nextProductCode = productCodeDraft.trim();
    if (!nextProductCode) {
      setError("반영할 상품코드를 입력해주세요.");
      return;
    }

    const previousProductCode = parseResult.summary.productCode;
    const nextRows = rows.map((row) => ({
      ...row,
      title: replaceProductCodeText(row.title, previousProductCode, nextProductCode)
    }));
    const nextSectionName = replaceProductCodeText(sectionName || parseResult.summary.sectionName, previousProductCode, nextProductCode);

    setRows(nextRows);
    setSectionName(nextSectionName);
    setParseResult({
      ...parseResult,
      previewRows: nextRows,
      summary: {
        ...parseResult.summary,
        productCode: nextProductCode,
        productCodeDetected: true,
        sectionName: nextSectionName
      }
    });
    setError("");
  }

  return (
    <main className="page">
      <div className="topbar">
        <div className="title">
          <h1>PDF 기획서 Asana 태스크 생성</h1>
          <p>PDF 내용을 기존 Apps Script 기준으로 파싱하고, 초안을 확인한 뒤 Asana에 생성합니다.</p>
        </div>
        <div className="status-pill">{parsing ? "파싱 중" : creating ? "생성 중" : "검토 후 생성"}</div>
      </div>

      <div className="grid">
        <aside className="panel">
          <div className="panel-header">
            <h2>업로드 및 생성 설정</h2>
          </div>
          <div className="panel-body">
            <PdfUpload selectedFile={selectedFile} disabled={parsing || creating} onFileSelected={handleFileSelected} />

            {parsing ? <div className="notice">PDF 텍스트를 추출하고 기존 파싱 기준으로 태스크 초안을 만드는 중입니다.</div> : null}
            {projectError ? <div className="error">{projectError}</div> : null}

            <div className="field-stack" style={{ marginTop: 16 }}>
              <div className="field">
                <label htmlFor="productCodeDraft">상품코드 일괄 변경</label>
                <div className="inline-field">
                  <input
                    id="productCodeDraft"
                    value={productCodeDraft}
                    onChange={(event) => setProductCodeDraft(event.target.value)}
                    placeholder={parseResult?.summary.productCodeDetected ? parseResult.summary.productCode : "예: P_123456ABC"}
                    disabled={!parseResult || creating}
                  />
                  <button type="button" className="secondary-button" disabled={!parseResult || creating} onClick={handleApplyProductCode}>
                    일괄 반영
                  </button>
                </div>
                {parseResult && !parseResult.summary.productCodeDetected ? (
                  <p className="field-help">상품코드를 찾지 못해 임시값으로 초안을 만들었습니다. 실제 코드를 넣고 반영하세요.</p>
                ) : (
                  <p className="field-help">입력한 코드가 섹션명과 모든 태스크 제목의 상품코드 부분에 반영됩니다.</p>
                )}
              </div>

              <div className="field">
                <label htmlFor="projectGid">Asana Project</label>
                <select id="projectGid" value={projectGid} onChange={(event) => setProjectGid(event.target.value)} disabled={creating || projects.length === 0}>
                  {projects.length === 0 ? <option value="">프로젝트 목록 없음</option> : null}
                  {projects.map((project) => (
                    <option key={project.gid} value={project.gid}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="sectionName">섹션명</label>
                <input
                  id="sectionName"
                  value={sectionName}
                  onChange={(event) => setSectionName(event.target.value)}
                  placeholder="예: 04/20 P_123456"
                  disabled={!parseResult || creating}
                />
              </div>
            </div>

            <div className="button-row">
              <span className="secondary-text">PDF는 장기 저장하지 않습니다.</span>
              <CreateButton disabled={!canCreate} creating={creating} onClick={handleCreate} />
            </div>

            {error ? <div className="error">{error}</div> : null}
            {success ? (
              <div className="success">
                태스크 {success.createdTasks.length}개를 생성했습니다.{" "}
                <a href={success.projectUrl} target="_blank" rel="noreferrer">
                  Asana 프로젝트 열기
                </a>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="field-stack">
          {parseResult ? (
            <>
              <ParseSummary summary={parseResult.summary} />
              <TaskPreviewTable rows={rows} onRowsChange={setRows} />
            </>
          ) : (
            <div className="empty-state">
              PDF를 업로드하면 상품코드, 이벤트 구분, 응모 마감일, 산출물 목록, 생성 예정 태스크가 여기에 표시됩니다.
              <br />
              검토 전에는 Asana 태스크를 만들지 않습니다.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function replaceProductCodeText(text: string, previousProductCode: string, nextProductCode: string): string {
  const source = String(text || "");
  const previous = previousProductCode.trim();
  const next = nextProductCode.trim();

  if (!next) return source;

  if (previous && source.includes(previous)) {
    return source.split(previous).join(next);
  }

  if (/^\[[^\]]+\]/.test(source)) {
    return source.replace(/^\[[^\]]+\]/, `[${next}]`);
  }

  if (/^\d{2}\/\d{2}\s+/.test(source)) {
    return source.replace(/^(\d{2}\/\d{2}\s+).+$/, `$1${next}`);
  }

  return source;
}
