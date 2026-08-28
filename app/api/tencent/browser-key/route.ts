import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const legacyVariableName = ["NEXT", "PUBLIC", "TENCENT", "MAP", "KEY"].join("_");
  const runtimeEnvironment = process.env as Record<string, string | undefined>;
  const key = (
    runtimeEnvironment.TENCENT_MAP_BROWSER_KEY ??
    runtimeEnvironment[legacyVariableName]
  )?.trim();
  if (!key) {
    return NextResponse.json(
      { error: "浏览器地图服务尚未配置。" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  return NextResponse.json(
    { key },
    { headers: { "Cache-Control": "no-store" } },
  );
}
