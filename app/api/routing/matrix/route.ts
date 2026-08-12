import { NextRequest, NextResponse } from "next/server";
import { gcj02ToWgs84 } from "../../../data-pipeline";
import {
  openRouteServiceProfile,
  type RouteMatrixProfile,
} from "../../../routing-profiles";

type MatrixPoint = {
  id: string;
  lat: number;
  lng: number;
  coordinateSystem?: "gcj02" | "wgs84";
};

type MatrixPayload = {
  source: "osrm_public_demo" | "osrm_custom" | "openrouteservice";
  profile: RouteMatrixProfile;
  generatedAt: string;
  coordinateNormalization: string;
  sources: string[];
  destinations: string[];
  durationsMinutes: Array<Array<number | null>>;
  distancesKm?: Array<Array<number | null>>;
  cached?: boolean;
};

const matrixCache = new Map<string, { expiresAt: number; payload: MatrixPayload }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 40;

function validPoint(point: MatrixPoint) {
  return (
    Boolean(point.id) &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  );
}

function normalizePoints(points: MatrixPoint[]) {
  return points.map((point) => {
    const normalized = point.coordinateSystem === "wgs84"
      ? point
      : gcj02ToWgs84(point);
    return { ...point, lat: normalized.lat, lng: normalized.lng };
  });
}

function cacheKey(profile: RouteMatrixProfile, points: MatrixPoint[], sourceCount: number) {
  const coordinates = points
    .map((point) => `${point.id}@${point.lng.toFixed(5)},${point.lat.toFixed(5)}`)
    .join(";");
  return `${profile}:${sourceCount}:${coordinates}`;
}

function remember(key: string, payload: MatrixPayload) {
  if (matrixCache.size >= CACHE_LIMIT) {
    const oldestKey = matrixCache.keys().next().value;
    if (oldestKey) matrixCache.delete(oldestKey);
  }
  matrixCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
}

async function requestOsrm(
  sources: MatrixPoint[],
  destinations: MatrixPoint[],
  points: MatrixPoint[],
): Promise<MatrixPayload> {
  const endpoint = process.env.OSRM_TABLE_ENDPOINT?.trim() || "https://router.project-osrm.org";
  if (!/^https?:\/\//i.test(endpoint)) throw new Error("OSRM endpoint 无效。");
  const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(";");
  const sourceIndexes = sources.map((_, index) => index).join(";");
  const destinationIndexes = destinations
    .map((_, index) => sources.length + index)
    .join(";");
  const url = new URL(`/table/v1/driving/${coordinates}`, endpoint);
  url.searchParams.set("sources", sourceIndexes);
  url.searchParams.set("destinations", destinationIndexes);
  url.searchParams.set("annotations", "duration,distance");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "UrbanHousingPlanningPrototype/1.0",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`OSRM 返回 HTTP ${response.status}`);
  const payload = (await response.json()) as {
    code?: string;
    message?: string;
    durations?: Array<Array<number | null>>;
    distances?: Array<Array<number | null>>;
  };
  if (payload.code !== "Ok" || !payload.durations) {
    throw new Error(payload.message || payload.code || "OSRM 未返回矩阵。");
  }
  return {
    source: endpoint.includes("router.project-osrm.org") ? "osrm_public_demo" : "osrm_custom",
    profile: "driving",
    generatedAt: new Date().toISOString(),
    coordinateNormalization: "GCJ-02 输入已转换为 WGS-84 后送入 OSRM",
    sources: sources.map((point) => point.id),
    destinations: destinations.map((point) => point.id),
    durationsMinutes: payload.durations.map((row) =>
      row.map((value) => (value === null ? null : value / 60)),
    ),
    distancesKm: payload.distances?.map((row) =>
      row.map((value) => (value === null ? null : value / 1000)),
    ),
  };
}

async function requestOpenRouteService(
  profile: Exclude<RouteMatrixProfile, "driving">,
  sources: MatrixPoint[],
  destinations: MatrixPoint[],
  points: MatrixPoint[],
): Promise<MatrixPayload> {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY?.trim();
  if (!apiKey) throw new Error("服务端尚未配置 OpenRouteService Key。");
  const endpoint = (
    process.env.OPENROUTESERVICE_MATRIX_ENDPOINT?.trim() ||
    "https://api.openrouteservice.org/v2/matrix"
  ).replace(/\/$/, "");
  if (!/^https?:\/\//i.test(endpoint)) throw new Error("OpenRouteService endpoint 无效。");
  const response = await fetch(`${endpoint}/${openRouteServiceProfile(profile)}`, {
    method: "POST",
    headers: {
      Accept: "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
      Authorization: apiKey,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      locations: points.map((point) => [point.lng, point.lat]),
      sources: sources.map((_, index) => String(index)),
      destinations: destinations.map((_, index) => String(sources.length + index)),
      metrics: ["duration", "distance"],
      units: "km",
    }),
    signal: AbortSignal.timeout(25_000),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    durations?: Array<Array<number | null>>;
    distances?: Array<Array<number | null>>;
    error?: { message?: string } | string;
  };
  if (!response.ok || !payload.durations) {
    const reason = typeof payload.error === "string" ? payload.error : payload.error?.message;
    throw new Error(reason || `OpenRouteService 返回 HTTP ${response.status}`);
  }
  return {
    source: "openrouteservice",
    profile,
    generatedAt: new Date().toISOString(),
    coordinateNormalization: "GCJ-02 输入已转换为 WGS-84 后送入 OpenRouteService",
    sources: sources.map((point) => point.id),
    destinations: destinations.map((point) => point.id),
    durationsMinutes: payload.durations.map((row) =>
      row.map((value) => (value === null ? null : value / 60)),
    ),
    distancesKm: payload.distances,
  };
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    sources?: MatrixPoint[];
    destinations?: MatrixPoint[];
    profile?: RouteMatrixProfile;
  };
  const sources = (body.sources ?? []).filter(validPoint);
  const destinations = (body.destinations ?? []).filter(validPoint);
  const profile: RouteMatrixProfile = ["walking", "cycling"].includes(body.profile ?? "")
    ? (body.profile as RouteMatrixProfile)
    : "driving";
  const maximumPoints = profile === "driving" ? 90 : 70;
  if (!sources.length || !destinations.length || sources.length + destinations.length > maximumPoints) {
    return NextResponse.json(
      { error: `路网矩阵每批需要有效起终点，${profile === "driving" ? "OSRM" : "ORS"} 合计不超过 ${maximumPoints} 个点。` },
      { status: 400 },
    );
  }

  const points = normalizePoints([...sources, ...destinations]);
  const key = cacheKey(profile, points, sources.length);
  const cached = matrixCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ ...cached.payload, cached: true });
  }
  if (cached) matrixCache.delete(key);

  try {
    const payload = profile === "driving"
      ? await requestOsrm(sources, destinations, points)
      : await requestOpenRouteService(profile, sources, destinations, points);
    remember(key, payload);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "路网矩阵连接失败。",
      },
      { status: 502 },
    );
  }
}
