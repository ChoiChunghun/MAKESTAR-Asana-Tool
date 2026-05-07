import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAKESTAR 태스크 머신",
  description: "Word, PDF, Google Doc 기획서를 파싱해 Asana 태스크를 자동 생성하는 내부 운영 도구",
  icons: { icon: "/favicon.png" }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-jp.min.css"
        />
      </head>
      <body>
        {children}
        {/* docx 대용량 파일 클라이언트 파싱용 */}
        <Script src="/mammoth.browser.min.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
