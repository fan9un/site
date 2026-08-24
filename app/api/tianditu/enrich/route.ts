import { NextRequest, NextResponse } from "next/server";
import { gcj02ToWgs84 } from "../../../data-pipeline";
import { tiandituPoiToGcj02, type FusionPoi, type TiandituRawPoi } from "../../../map-fusion";

const housingKeywords = [
  "医院",
  "学校",
  "养老院",
  "公园",
  "图书馆",
  "火车站",
  "政务服务中心",
];

const worldCupKeywords = [
  "体育场",
  "酒店",
  "地铁站",
  "火车站",
  "公交枢纽",
  "医院",
  "急救中心",
  "餐厅",
  "商场",
  "公共厕所",
  "停车场",
];

type CacheEntry = { expiresAt: number; payload: unknown };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

function validCoordinate(value: number, limit: number) {
  return Number.isFinite(value) && Math.abs(value) <= limit;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    center?: { lat?: number; lng?: number };
    mode?: "housing" | "worldcup";
    radiusMeters?: number;
  };
  const lat = Number(body.center?.lat);
  const lng = Number(body.center?.lng);
  if (!validCoordinate(lat, 90) || !validCoordinate(lng, 180)) {
    return NextResponse.json({ error: "天地图增强需要有效的分析中心坐标。" }, { status: 400 });
  }
  const key =
    process.env.TIANDITU_SERVICE_KEY?.trim();
  if (!key) {
    return NextResponse.json({ error: "服务端尚未配置天地图 Key。" }, { status: 503 });
  }
  const radiusMeters = Math.max(1_000, Math.min(10_000, Number(body.radiusMeters) || 8_000));
  const wgsCenter = gcj02ToWgs84({ lat, lng });
  const keywords = body.mode === "worldcup" ? worldCupKeywords : housingKeywords;
  const cacheKey = `${lat.toFixed(4)}:${lng.toFixed(4)}:${radiusMeters}:${body.mode ?? "housing"}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ ...(cached.payload as object), cached: true });
  }

  const results: Array<{ keyword: string; count: number; error?: string }> = [];
  const pointIndex = new Map<string, FusionPoi>();
  for (let offset = 0; offset < keywords.length; offset += 2) {
    const batch = await Promise.all(
      keywords.slice(offset, offset + 2).map(async (keyword) => {
        const postStr = JSON.stringify({
          keyWord: keyword,
          level: 14,
          queryRadius: radiusMeters,
          pointLonlat: `${wgsCenter.lng},${wgsCenter.lat}`,
          queryType: 3,
          start: 0,
          count: 20,
          show: 1,
        });
        const url = new URL("https://api.tianditu.gov.cn/v2/search");
        url.searchParams.set("postStr", postStr);
        url.searchParams.set("type", "query");
        url.searchParams.set("tk", key);
        try {
          const response = await fetch(url, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(18_000),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = (await response.json()) as {
            count?: string | number;
            pois?: TiandituRawPoi[];
            status?: { infocode?: number; cndesc?: string };
          };
          if (payload.status?.infocode !== 1000 && payload.status?.infocode !== undefined) {
            throw new Error(payload.status.cndesc || `状态 ${payload.status.infocode}`);
          }
          const points = (payload.pois ?? []).flatMap((point) => {
            const normalized = tiandituPoiToGcj02(point, keyword);
            return normalized ? [normalized] : [];
          });
          return { keyword, points, total: Number(payload.count) || points.length };
        } catch (error) {
          return {
            keyword,
            points: [] as FusionPoi[],
            total: 0,
            error: error instanceof Error ? error.message : "请求失败",
          };
        }
      }),
    );
    batch.forEach((row) => {
      results.push({ keyword: row.keyword, count: row.points.length, error: row.error });
      row.points.forEach((point) => {
        const id = point.id ?? `${point.name}-${point.lat}-${point.lng}`;
        if (!pointIndex.has(id)) pointIndex.set(id, point);
      });
    });
  }

  const points = [...pointIndex.values()];
  const payload = {
    source: "tianditu",
    coordinateNormalization: "天地图 WGS-84/CGCS2000 点位已转换为平台 GCJ-02 坐标",
    count: points.length,
    categories: results,
    points,
    generatedAt: new Date().toISOString(),
  };
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL, payload });
  return NextResponse.json(payload);
}
