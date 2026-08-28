import type { Metadata } from "next";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const configuredOrigin = process.env.SITE_ORIGIN?.trim();
  const origin = configuredOrigin && /^https?:\/\//i.test(configuredOrigin)
    ? new URL(configuredOrigin).origin
    : "https://hengyu-city-equity.fan9uun.chatgpt.site";
  const imageUrl = new URL("/og.png", origin).toString();

  return {
    title: "衡域｜城市设施公平规划平台",
    description: "让每个生活圈更均衡，让每一座场馆真正承载一座城市。",
    openGraph: {
      title: "衡域｜城市设施公平规划平台",
      description: "让每个生活圈更均衡，让每一座场馆真正承载一座城市。",
      type: "website",
      url: origin,
      images: [{ url: imageUrl, width: 1792, height: 921, alt: "衡域城市设施公平规划平台" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "衡域｜城市设施公平规划平台",
      description: "让每个生活圈更均衡，让每一座场馆真正承载一座城市。",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
