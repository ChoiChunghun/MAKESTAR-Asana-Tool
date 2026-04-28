"use client";

import { useRef, useState } from "react";

type PdfUploadProps = {
  selectedFile: File | null;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
};

export function PdfUpload({ selectedFile, disabled = false, onFileSelected }: PdfUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isActive, setIsActive] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    onFileSelected(file);
  }

  return (
    <div>
      <button
        type="button"
        className={`upload-zone ${isActive ? "is-active" : ""}`}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsActive(true);
        }}
        onDragLeave={() => setIsActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsActive(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => handleFiles(event.target.files)}
          disabled={disabled}
        />
        <span className="upload-title">PDF 기획서 업로드</span>
        <p className="upload-help">파일을 여기에 끌어놓거나 클릭해서 선택하세요. 선택하면 바로 파싱을 시작합니다.</p>
      </button>
      {selectedFile ? <div className="selected-file">선택한 파일: {selectedFile.name}</div> : null}
    </div>
  );
}
