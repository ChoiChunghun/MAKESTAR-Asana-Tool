import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAKESTAR 태스크 머신",
  description: "PDF, Word, Google Doc 기획서를 파싱해 Asana 태스크를 자동 생성하는 내부 운영 도구",
  icons: { icon: "/favicon.png" }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
