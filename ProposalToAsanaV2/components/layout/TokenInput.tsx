"use client";

import { useState } from "react";

type Props = {
  token: string;
  onTokenChange: (t: string) => void;
};

export function TokenInput({ token, onTokenChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(token);
  const [show, setShow] = useState(false);

  function save() {
    onTokenChange(draft.trim());
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(token); setOpen(true); }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
          token
            ? "border-[#87e89e] text-[#20903c] bg-[#e3fce8] hover:bg-[#d0f7d8]"
            : "border-[#f7baba] text-[#e61919] bg-[#fde8e8] hover:bg-[#fcd4d4]"
        }`}
      >
        <span>{token ? "●" : "○"}</span>
        {token ? "Asana 연결됨" : "Asana 토큰 필요"}
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="absolute right-0 top-8 z-50 w-80 card shadow-xl shadow-black/50 border border-ms-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-ms-text">Asana 토큰 설정</h3>
          <button type="button" onClick={() => setOpen(false)} className="text-ms-muted hover:text-ms-text text-lg leading-none">×</button>
        </div>
        <p className="text-ms-muted text-xs mb-3">
          Asana Personal Access Token을 입력하세요.{" "}
          <a href="https://app.asana.com/0/my-apps" target="_blank" rel="noopener noreferrer" className="text-ms-accent hover:underline">
            발급 →
          </a>
        </p>
        <div className="relative mb-2">
          <input
            type={show ? "text" : "password"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="1/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            autoFocus
            className="ms-input pr-12 font-mono text-xs"
          />
          <button type="button" onClick={() => setShow((p) => !p)} className="absolute right-2 top-1/2 -translate-y-1/2 text-ms-muted hover:text-ms-text text-xs">
            {show ? "숨김" : "표시"}
          </button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={save} disabled={!draft.trim()} className="btn-accent flex-1 py-1.5 text-xs">
            저장
          </button>
          {token && (
            <button
              type="button"
              onClick={() => { onTokenChange(""); setDraft(""); setOpen(false); }}
              className="btn px-3 py-1.5 text-xs"
            >
              연결 해제
            </button>
          )}
        </div>
        <p className="text-ms-faint text-xs mt-2">브라우저 세션 스토리지에만 저장되며, 탭을 닫으면 자동 삭제됩니다.</p>
      </div>
    </div>
  );
}
