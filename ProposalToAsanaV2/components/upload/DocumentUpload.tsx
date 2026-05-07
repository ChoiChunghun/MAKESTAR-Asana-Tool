"use client";

import { useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  onFileSelected: (file: File) => void;
  onGoogleDocUrl: (url: string) => void;
};

export function DocumentUpload({ disabled = false, onFileSelected, onGoogleDocUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tab, setTab] = useState<"file" | "googledoc">("file");
  const [googleUrl, setGoogleUrl] = useState("");

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    onFileSelected(file);
  }

  return (
    <div className="card">
      <div className="flex gap-2 mb-4">
        {(["file", "googledoc"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              tab === t
                ? "bg-ms-accent text-white"
                : "bg-ms-subtle text-ms-muted hover:text-white"
            }`}
          >
            {t === "file" ? "파일 업로드" : "Google Doc"}
          </button>
        ))}
      </div>

      {tab === "file" ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`w-full border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            isDragging
              ? "border-ms-accent bg-ms-accent/10"
              : "border-ms-border hover:border-ms-accent/50 hover:bg-ms-hover"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={disabled}
            className="hidden"
          />
          <div className="text-3xl mb-3">📄</div>
          <p className="text-white font-medium mb-1">기획서를 여기에 끌어놓거나 클릭해서 선택하세요</p>
          <p className="text-ms-muted text-sm">Word (.docx) 또는 PDF 파일 지원</p>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="bg-ms-subtle border border-ms-border rounded-lg px-3 py-2.5 text-xs text-ms-muted leading-relaxed">
            <span className="text-ms-accent font-medium">[보안 : Beta에서 제외]</span>
            {"  "}
            <span className="text-white font-medium">공유 설정 필수</span>
            {"  "}문서 우측 상단 <strong className="text-ms-text">공유</strong> →{" "}
            <strong className="text-ms-text">링크가 있는 모든 사용자</strong> → <strong className="text-ms-text">뷰어</strong>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={googleUrl}
              onChange={(e) => setGoogleUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/..."
              disabled={disabled}
              className="ms-input flex-1"
            />
            <button
              type="button"
              disabled={disabled || !googleUrl.trim()}
              onClick={() => onGoogleDocUrl(googleUrl.trim())}
              className="btn-accent"
            >
              불러오기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
