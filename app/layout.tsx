import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
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
