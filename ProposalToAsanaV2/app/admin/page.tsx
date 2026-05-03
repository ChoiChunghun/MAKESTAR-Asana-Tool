"use client";

import { useEffect, useState, useCallback } from "react";
import type { ActivityEntry } from "@/lib/activityLog";

const ADMIN_CONFIG_KEY = "proposal2asana_admin_config";
const ADMIN_AUTH_KEY = "proposal2asana_admin_auth";

type StringListField = { items: string[]; label: string; description: string };

type ArtistDesignerRule = { artistName: string; designerGid: string };

type AdminConfig = {
  benefitKeywords: string[];
  pcExcludeKeywords: string[];
  handwritingKeywords: string[];
  vmdConditionLabels: string[];
  dueDaysOffset: number;
  vmdItemCount: number;
  designerGid: string;
  followerGids: string[];
  artistDesignerRules: ArtistDesignerRule[];
  customFieldGids: {
    statusField: string;
    taskTypeField: string;
    taskTypeMd: string;
    taskTypePc: string;
    taskTypeUpdate: string;
    taskTypeOpen: string;
    taskTypeVmd: string;
    taskTypeEtc: string;
    eventTypeField: string;
  };
  taskNotes: {
    md: string;
    update: string;
    open: string;
    vmd: string;
    winner: string;
  };
};

const DEFAULT_CONFIG: AdminConfig = {
  benefitKeywords: [
    "키링", "사진", "컷", "볼펜", "티켓", "L홀더", "스티커", "코스터", "엽서",
    "핀버튼", "파우치", "피크", "골트래커", "골 트래커", "키캡", "명찰", "스마트톡",
    "띠부씰", "손거울", "메모지", "쿠폰", "우표", "뱃지", "카드", "탑로더",
    "인화 2컷", "인화 4컷", "증명사진", "메시지 카드", "시험지"
  ],
  pcExcludeKeywords: ["참석권", "관람권", "앨범", "이벤트", "키링", "폴라로이드", "포스트잇"],
  handwritingKeywords: ["부적", "상장", "탐정", "메시지", "생일", "프리쿠라", "메세지", "낙서", "행운"],
  vmdConditionLabels: ["쇼케이스 초대", "대면", "포토", "오프라인 이벤트", "오프라인 럭키드로우"],
  dueDaysOffset: 7,
  vmdItemCount: 4,
  designerGid: "",
  followerGids: [],
  artistDesignerRules: [],
  customFieldGids: {
    statusField: "1207665965030077",
    taskTypeField: "1213891002087335",
    taskTypeMd: "1213891002087339",
    taskTypePc: "1213891002087338",
    taskTypeUpdate: "1213891002087337",
    taskTypeOpen: "1212593461428977",
    taskTypeVmd: "1212593461428981",
    taskTypeEtc: "1212593461428982",
    eventTypeField: "1212472934572818"
  },
  taskNotes: {
    md: '발주 후 "완료" 처리 부탁드립니다!',
    update: 'SNS 발행 후 "완료" 처리 부탁드립니다!',
    open: '페이지 작업 후 "완료" 처리 부탁드립니다!',
    vmd: '발주 후 "완료" 처리 부탁드립니다!',
    winner: "당첨자 관련 업무 스케줄링을 위한 태스크입니다!"
  }
};

type EnumOption = { gid: string; name: string };
type CustomFieldInfo = { gid: string; name: string; type: string; enumOptions?: EnumOption[] };

const TOKEN_KEY = "proposal2asana_token";

export default function AdminPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [config, setConfig] = useState<AdminConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<"parsing" | "tasks" | "fields" | "history">("parsing");
  const [savedMsg, setSavedMsg] = useState("");

  // 커스텀 필드 조회
  const [lookupProjectGid, setLookupProjectGid] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [lookedUpFields, setLookedUpFields] = useState<CustomFieldInfo[]>([]);
  const [copiedGid, setCopiedGid] = useState("");

  // ── 생성 이력 ───────────────────────────────────────────────────────────
  const [historyEntries, setHistoryEntries] = useState<ActivityEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyClearing, setHistoryClearing] = useState(false);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const res = await fetch("/api/admin/activity?limit=200", {
        headers: { "x-admin-password": password }
      });
      const data = await res.json() as { entries?: ActivityEntry[]; message?: string };
      if (!res.ok) throw new Error(data.message);
      setHistoryEntries(data.entries ?? []);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "이력 조회 실패");
    } finally {
      setHistoryLoading(false);
    }
  }, [password]);

  useEffect(() => {
    if (activeTab === "history" && isAuth) fetchHistory();
  }, [activeTab, isAuth, fetchHistory]);

  async function clearHistory() {
    if (!confirm("전체 생성 이력을 삭제하시겠습니까?")) return;
    setHistoryClearing(true);
    try {
      await fetch("/api/admin/activity", {
        method: "DELETE",
        headers: { "x-admin-password": password }
      });
      setHistoryEntries([]);
    } finally {
      setHistoryClearing(false);
    }
  }

  async function fetchCustomFields() {
    const token = sessionStorage.getItem(TOKEN_KEY) || "";
    if (!token) { setLookupError("메인 페이지에서 Asana 토큰을 먼저 입력해주세요."); return; }
    if (!lookupProjectGid.trim()) { setLookupError("프로젝트 GID를 입력해주세요."); return; }
    setLookupLoading(true);
    setLookupError("");
    setLookedUpFields([]);
    try {
      const res = await fetch(`/api/asana/custom-fields?projectGid=${lookupProjectGid.trim()}`, {
        headers: { "x-asana-token": token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setLookedUpFields(data.fields || []);
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLookupLoading(false);
    }
  }

  function copyGid(gid: string) {
    navigator.clipboard.writeText(gid).then(() => {
      setCopiedGid(gid);
      setTimeout(() => setCopiedGid(""), 1500);
    });
  }

  useEffect(() => {
    const auth = sessionStorage.getItem(ADMIN_AUTH_KEY);
    if (auth === "true") setIsAuth(true);
    const saved = localStorage.getItem(ADMIN_CONFIG_KEY);
    if (saved) {
      try {
        setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) });
      } catch { /* ignore */ }
    }
  }, []);

  async function handleLogin() {
    if (!password.trim()) { setAuthError("비밀번호를 입력해주세요."); return; }
    setAuthError("");
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await res.json() as { ok: boolean; message?: string };
      if (data.ok) {
        setIsAuth(true);
        sessionStorage.setItem(ADMIN_AUTH_KEY, "true");
      } else {
        setAuthError(data.message || "비밀번호가 올바르지 않습니다.");
      }
    } catch {
      setAuthError("인증 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
  }

  function saveConfig() {
    localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(config));
    setSavedMsg("저장되었습니다.");
    setTimeout(() => setSavedMsg(""), 2000);
  }

  function resetConfig() {
    if (confirm("기본값으로 초기화하시겠습니까?")) {
      setConfig(DEFAULT_CONFIG);
      localStorage.removeItem(ADMIN_CONFIG_KEY);
    }
  }

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-ms-bg flex items-center justify-center">
        <div className="card w-full max-w-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-ms-accent flex items-center justify-center text-sm font-bold text-white">M</div>
            <h1 className="text-white font-bold">관리자 페이지</h1>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="비밀번호"
            className="ms-input mb-3"
          />
          {authError && <p className="text-red-400 text-sm mb-3">{authError} 디자인센터(최충훈)에게 문의하세요.</p>}
          <button type="button" onClick={handleLogin} className="btn-accent w-full py-2">
            로그인
          </button>
          <a href="/" className="block text-center text-ms-muted hover:text-white text-sm mt-4">
            ← 메인으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "parsing" as const,  label: "파싱 조건" },
    { id: "tasks"   as const,  label: "태스크 설정" },
    { id: "fields"  as const,  label: "커스텀 필드 GID" },
    { id: "history" as const,  label: "생성 이력" }
  ];

  return (
    <div className="min-h-screen bg-ms-bg text-ms-text">
      <header className="border-b border-ms-border bg-ms-panel">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-ms-accent flex items-center justify-center text-sm font-bold text-white">M</div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">관리자 설정</h1>
              <p className="text-ms-muted text-xs mt-0.5">파싱 조건 및 Asana 연동 설정</p>
            </div>
          </div>
          <a href="/" className="text-ms-muted hover:text-white text-sm">← 메인으로</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex gap-2 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === t.id
                  ? "bg-ms-accent text-white"
                  : "bg-ms-subtle text-ms-muted hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "parsing" && (
          <div className="space-y-6">
            <KeywordEditor
              label="특전 인식 키워드"
              description="이 키워드가 포함된 줄에서 특전 항목을 추출합니다. 포토카드는 제외됩니다."
              items={config.benefitKeywords}
              onChange={(items) => setConfig({ ...config, benefitKeywords: items })}
            />
            <KeywordEditor
              label="포토카드 제외 키워드"
              description="'포토카드'가 포함된 줄이라도 이 키워드가 있으면 포토카드로 인식하지 않습니다."
              items={config.pcExcludeKeywords}
              onChange={(items) => setConfig({ ...config, pcExcludeKeywords: items })}
            />
            <KeywordEditor
              label="손그림 여부 키워드"
              description="이 키워드가 포함된 산출물은 '손그림, 글씨 사용 여부: O'로 표시됩니다."
              items={config.handwritingKeywords}
              onChange={(items) => setConfig({ ...config, handwritingKeywords: items })}
            />
            <KeywordEditor
              label="VMD 생성 대상 이벤트 구분"
              description="아래 이벤트 구분 중 하나라도 감지되면 VMD 태스크를 생성합니다."
              items={config.vmdConditionLabels}
              onChange={(items) => setConfig({ ...config, vmdConditionLabels: items })}
            />
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-base font-semibold text-white mb-4">담당자 설정</h3>
              <div>
                <label className="ms-label">
                  디자인 서브태스크 담당자 GID
                  <span className="text-ms-faint font-normal">포토카드·특전·오픈디자인·업데이트·VMD 하위 태스크</span>
                </label>
                <input
                  type="text"
                  value={config.designerGid}
                  onChange={(e) => setConfig({ ...config, designerGid: e.target.value.trim() })}
                  placeholder="Asana 사용자 GID (숫자) — 예: 최충훈"
                  className="ms-input font-mono"
                />
                <p className="ms-hint">비워두면 토큰 사용자가 모든 태스크의 담당자로 지정됩니다. GID는 Asana 프로필 URL에서 확인할 수 있습니다.</p>
              </div>
            </div>

            {/* 협업 참여자 */}
            <div className="card">
              <h3 className="text-base font-semibold text-white mb-1">협업 참여자 (Followers)</h3>
              <p className="ms-hint mb-3">여기에 입력된 GID의 사용자가 모든 생성 태스크의 협업 참여자로 추가됩니다. GID를 쉼표 또는 줄바꿈으로 구분해 입력하세요.</p>
              <textarea
                rows={3}
                value={config.followerGids.join("\n")}
                onChange={(e) => {
                  const gids = e.target.value
                    .split(/[\n,]+/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  setConfig({ ...config, followerGids: gids });
                }}
                placeholder={"123456789012345\n987654321098765"}
                className="ms-input font-mono text-xs resize-none"
              />
              <p className="ms-hint">Asana 프로필 URL(app.asana.com/0/~GID)에서 GID를 확인하세요.</p>
            </div>

            {/* 아티스트별 하위 태스크 담당자 */}
            <div className="card">
              <h3 className="text-base font-semibold text-white mb-1">아티스트별 하위 태스크 담당자</h3>
              <p className="ms-hint mb-3">특정 아티스트 이름이 감지되면, 해당 이벤트의 서브태스크(포카·특전·오픈디자인 등)에 지정된 담당자 GID를 사용합니다.</p>
              <div className="space-y-2 mb-3">
                {config.artistDesignerRules.map((rule, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={rule.artistName}
                      onChange={(e) => {
                        const updated = [...config.artistDesignerRules];
                        updated[idx] = { ...updated[idx], artistName: e.target.value };
                        setConfig({ ...config, artistDesignerRules: updated });
                      }}
                      placeholder="아티스트명 (부분 일치)"
                      className="ms-input flex-1 text-xs"
                    />
                    <input
                      type="text"
                      value={rule.designerGid}
                      onChange={(e) => {
                        const updated = [...config.artistDesignerRules];
                        updated[idx] = { ...updated[idx], designerGid: e.target.value.trim() };
                        setConfig({ ...config, artistDesignerRules: updated });
                      }}
                      placeholder="담당자 GID"
                      className="ms-input w-44 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = config.artistDesignerRules.filter((_, i) => i !== idx);
                        setConfig({ ...config, artistDesignerRules: updated });
                      }}
                      className="text-ms-faint hover:text-red-400 text-sm px-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setConfig({
                    ...config,
                    artistDesignerRules: [...config.artistDesignerRules, { artistName: "", designerGid: "" }]
                  })
                }
                className="btn text-sm py-1.5 px-3"
              >
                + 규칙 추가
              </button>
            </div>

            <div className="card">
              <h3 className="text-base font-semibold text-white mb-4">기본 마감일 설정</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="ms-label">마감일 폴백 (응모마감 없을 때 +N일)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={config.dueDaysOffset}
                    onChange={(e) => setConfig({ ...config, dueDaysOffset: Number(e.target.value) })}
                    className="ms-input"
                  />
                </div>
                <div>
                  <label className="ms-label">VMD 산출물 고정 수량</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={config.vmdItemCount}
                    onChange={(e) => setConfig({ ...config, vmdItemCount: Number(e.target.value) })}
                    className="ms-input"
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-base font-semibold text-white mb-4">태스크 기본 메모</h3>
              <div className="space-y-3">
                {(Object.entries(config.taskNotes) as [keyof typeof config.taskNotes, string][]).map(([key, value]) => (
                  <div key={key}>
                    <label className="ms-label">
                      {key === "md" ? "MD" : key === "update" ? "업데이트" : key === "open" ? "오픈" : key === "vmd" ? "VMD" : "당첨자 선정"}
                    </label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setConfig({ ...config, taskNotes: { ...config.taskNotes, [key]: e.target.value } })}
                      className="ms-input"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "fields" && (
          <div className="space-y-6">

            {/* ── 자동 조회 패널 ── */}
            <div className="card">
              <h3 className="text-base font-semibold text-white mb-1">🔍 프로젝트에서 GID 자동 조회</h3>
              <p className="ms-hint mb-4">프로젝트 GID를 입력하고 조회하면 커스텀 필드와 옵션 GID를 한눈에 확인할 수 있습니다. GID를 클릭하면 클립보드에 복사됩니다.</p>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={lookupProjectGid}
                  onChange={(e) => setLookupProjectGid(e.target.value.trim())}
                  onKeyDown={(e) => e.key === "Enter" && fetchCustomFields()}
                  placeholder="프로젝트 GID (숫자)"
                  className="ms-input flex-1 font-mono"
                />
                <button
                  type="button"
                  onClick={fetchCustomFields}
                  disabled={lookupLoading}
                  className="btn px-4"
                >
                  {lookupLoading ? <span className="spinner-sm" /> : "조회"}
                </button>
              </div>
              {lookupError && <p className="text-red-400 text-xs mb-3">⚠ {lookupError} 디자인센터(최충훈)에게 문의하세요.</p>}

              {lookedUpFields.length > 0 && (
                <div className="space-y-4 mt-2">
                  {lookedUpFields.map((field) => (
                    <div key={field.gid} className="rounded-lg bg-ms-bg border border-ms-border/40 p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-white text-sm font-semibold">{field.name}</span>
                        <span className="text-ms-faint text-xs">({field.type})</span>
                      </div>
                      {/* 필드 GID */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-ms-muted text-xs w-16 shrink-0">필드 GID</span>
                        <button
                          type="button"
                          onClick={() => copyGid(field.gid)}
                          className={`font-mono text-xs px-2 py-0.5 rounded border transition-colors ${
                            copiedGid === field.gid
                              ? "border-green-500/50 text-green-400 bg-green-500/10"
                              : "border-ms-border/50 text-ms-accent hover:border-ms-accent/50 bg-ms-subtle"
                          }`}
                        >
                          {copiedGid === field.gid ? "✓ 복사됨" : field.gid}
                        </button>
                      </div>
                      {/* Enum 옵션 */}
                      {field.enumOptions && field.enumOptions.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-ms-faint text-xs mb-1">옵션 GID</p>
                          {field.enumOptions.map((opt) => (
                            <div key={opt.gid} className="flex items-center gap-2">
                              <span className="text-ms-muted text-xs w-36 shrink-0 truncate">{opt.name}</span>
                              <button
                                type="button"
                                onClick={() => copyGid(opt.gid)}
                                className={`font-mono text-xs px-2 py-0.5 rounded border transition-colors ${
                                  copiedGid === opt.gid
                                    ? "border-green-500/50 text-green-400 bg-green-500/10"
                                    : "border-ms-border/50 text-ms-faint hover:text-ms-accent hover:border-ms-accent/50 bg-ms-subtle"
                                }`}
                              >
                                {copiedGid === opt.gid ? "✓ 복사됨" : opt.gid}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── 수동 입력 폼 ── */}
            <div className="card">
              <h3 className="text-base font-semibold text-white mb-2">GID 직접 입력</h3>
              <p className="ms-hint mb-4">위 조회 결과에서 복사한 GID를 붙여넣으세요. 비워두면 해당 필드는 설정되지 않습니다.</p>
              <div className="space-y-3">
                {(Object.entries(config.customFieldGids) as [string, string][]).map(([key, value]) => (
                  <div key={key} className="flex gap-3 items-center">
                    <label className="text-ms-muted text-sm w-40 shrink-0">{fieldKeyLabel(key)}</label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          customFieldGids: { ...config.customFieldGids, [key]: e.target.value.trim() }
                        })
                      }
                      placeholder="GID (숫자)"
                      className="ms-input font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold">태스크 생성 이력</h2>
                <p className="text-ms-muted text-xs mt-0.5">베타 테스트 기간 중 모든 사용자의 생성 이벤트 — 최근 200건</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={fetchHistory} disabled={historyLoading} className="btn px-3 py-1.5 text-sm">
                  {historyLoading ? <span className="spinner-sm" /> : "새로고침"}
                </button>
                <button type="button" onClick={clearHistory} disabled={historyClearing} className="btn px-3 py-1.5 text-sm text-red-400 hover:text-red-300">
                  전체 삭제
                </button>
              </div>
            </div>

            {historyError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {historyError === "KV not configured"
                  ? "Vercel KV가 연결되지 않았습니다. Vercel 대시보드 → Storage → KV를 먼저 설정해주세요."
                  : historyError}
              </div>
            )}

            {!historyError && historyEntries.length === 0 && !historyLoading && (
              <div className="card text-center py-10 text-ms-muted text-sm">아직 생성 이력이 없습니다.</div>
            )}

            {historyEntries.length > 0 && (
              <div className="space-y-2">
                {/* 요약 카운터 */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="card py-3 text-center">
                    <p className="text-ms-gold text-2xl font-bold">{historyEntries.length}</p>
                    <p className="text-ms-muted text-xs mt-1">총 생성 건수</p>
                  </div>
                  <div className="card py-3 text-center">
                    <p className="text-ms-gold text-2xl font-bold">
                      {historyEntries.reduce((s, e) => s + e.taskCount, 0)}
                    </p>
                    <p className="text-ms-muted text-xs mt-1">생성된 태스크 수</p>
                  </div>
                  <div className="card py-3 text-center">
                    <p className="text-ms-gold text-2xl font-bold">
                      {new Set(historyEntries.map((e) => e.tokenHint)).size}
                    </p>
                    <p className="text-ms-muted text-xs mt-1">사용자 수 (추정)</p>
                  </div>
                </div>

                {/* 이력 테이블 */}
                <div className="overflow-x-auto rounded-lg border border-ms-border/50">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ms-border/50 bg-ms-subtle">
                        <th className="text-left text-ms-muted font-medium px-3 py-2 w-36">시각</th>
                        <th className="text-left text-ms-muted font-medium px-3 py-2">섹션 (이벤트)</th>
                        <th className="text-left text-ms-muted font-medium px-3 py-2">아티스트</th>
                        <th className="text-left text-ms-muted font-medium px-3 py-2">이벤트 구분</th>
                        <th className="text-left text-ms-muted font-medium px-3 py-2 w-16">태스크</th>
                        <th className="text-left text-ms-muted font-medium px-3 py-2 w-16">사용자</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyEntries.map((entry) => (
                        <tr key={entry.id} className="border-b border-ms-border/30 hover:bg-ms-subtle/50 transition-colors">
                          <td className="px-3 py-2 text-ms-faint font-mono text-xs whitespace-nowrap">
                            {new Date(entry.ts).toLocaleString("ko-KR", {
                              month: "2-digit", day: "2-digit",
                              hour: "2-digit", minute: "2-digit"
                            })}
                          </td>
                          <td className="px-3 py-2 text-white text-xs max-w-48 truncate" title={entry.sectionName}>
                            {entry.sectionName}
                            {entry.isDerivative && (
                              <span className="ml-1.5 text-ms-gold text-xs">파생</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-ms-text text-xs">{entry.artistName || "—"}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {(entry.eventLabels ?? []).map((l) => (
                                <span key={l} className="text-xs px-1.5 py-0.5 rounded bg-ms-accent/20 text-ms-accent">{l}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-ms-text text-xs text-center">{entry.taskCount}</td>
                          <td className="px-3 py-2 text-ms-faint font-mono text-xs">···{entry.tokenHint}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab !== "history" && (
        <div className="flex items-center gap-3 mt-8">
          <button type="button" onClick={saveConfig} className="btn-accent px-6 py-2.5">
            저장
          </button>
          <button type="button" onClick={resetConfig} className="btn px-6 py-2.5">
            기본값으로 초기화
          </button>
          {savedMsg && <span className="dot-green text-sm">{savedMsg}</span>}
        </div>
        )}
      </main>
    </div>
  );
}

function fieldKeyLabel(key: string): string {
  const map: Record<string, string> = {
    statusField:    "상태 필드 GID",
    taskTypeField:  "태스크 구분 필드 GID",
    taskTypeMd:     "태스크 구분 → MD",
    taskTypePc:     "태스크 구분 → 포토카드",
    taskTypeUpdate: "태스크 구분 → 업데이트",
    taskTypeOpen:   "태스크 구분 → 오픈",
    taskTypeVmd:    "태스크 구분 → VMD",
    taskTypeEtc:    "태스크 구분 → 기타",
    eventTypeField: "이벤트 구분 필드 GID"
  };
  return map[key] ?? key;
}

function KeywordEditor({
  label,
  description,
  items,
  onChange
}: StringListField & { onChange: (items: string[]) => void }) {
  const [newItem, setNewItem] = useState("");

  function add() {
    if (!newItem.trim() || items.includes(newItem.trim())) return;
    onChange([...items, newItem.trim()]);
    setNewItem("");
  }

  function remove(item: string) {
    onChange(items.filter((i) => i !== item));
  }

  return (
    <div className="card">
      <h3 className="text-base font-semibold text-white mb-1">{label}</h3>
      <p className="ms-hint mb-3">{description}</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {items.map((item) => (
          <span key={item} className="ms-tag">
            {item}
            <button
              type="button"
              onClick={() => remove(item)}
              className="text-ms-muted hover:text-red-400 text-xs ml-0.5"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="키워드 추가..."
          className="ms-input flex-1"
        />
        <button type="button" onClick={add} className="btn">
          추가
        </button>
      </div>
    </div>
  );
}
