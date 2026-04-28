import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF 기획서 Asana 태스크 생성",
  description: "PDF 기획서를 파싱해 Asana 태스크 초안을 만들고 검토 후 생성하는 내부 운영 도구"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
