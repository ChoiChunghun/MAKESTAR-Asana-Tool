"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-ms-bg text-ms-text flex items-center justify-center">
      <div className="card w-full max-w-md text-center py-12">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-white font-bold text-xl mb-2">오류가 발생했습니다</h2>
        <p className="text-ms-muted text-sm mb-6 break-words">
          {error.message || "알 수 없는 오류입니다."}<br />
          디자인센터(최충훈)에게 문의하세요.
        </p>
        <div className="flex gap-3 justify-center">
          <button type="button" onClick={reset} className="btn-accent px-5 py-2">
            다시 시도
          </button>
          <a href="/" className="btn px-5 py-2">
            처음으로
          </a>
        </div>
      </div>
    </div>
  );
}
