"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ background: "#0b0b0b", color: "#e5e7eb", fontFamily: "sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center", padding: "2rem", maxWidth: "400px" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
            <h2 style={{ color: "#fff", marginBottom: "0.5rem" }}>
              페이지 로드 중 오류가 발생했습니다
            </h2>
            <p style={{ color: "#9ca3af", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
              {error.message || "알 수 없는 오류입니다."}<br />
              디자인센터(최충훈)에게 문의하세요.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                background: "#FF558F",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "0.5rem 1.5rem",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              새로고침
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
