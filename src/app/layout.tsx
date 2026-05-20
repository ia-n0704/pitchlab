import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PitchLab — Upper + Lower Body Kinetic Chain Analyzer",
  description:
    "스마트폰 영상 한 편으로 상체·골반 운동연쇄를 정량 분석합니다. 프로 표준 분포와 생체역학 이상 모델 두 축으로, 에너지가 손실되는 정확한 시점을 짚어냅니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
