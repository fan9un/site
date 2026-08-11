import { NextRequest, NextResponse } from "next/server";
import { gcj02ToWgs84 } from "../../../data-pipeline";

type MatrixPoint = {
  id: string;
  lat: number;
  lng: number;
  coordinateSystem?: "gcj02" | "wgs84";
};

function validPoint(point: MatrixPoint) {
  return (
    Boolean(point.id) &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    sources?: MatrixPoint[];
    destinations?: MatrixPoint[];
  };
  const sources = (body.sources ?? []).filter(validPoint);
  const destinations = (body.destinations ?? []).filter(validPoint);
  if (!sources.length || !destinations.length || sources.length + destinations.length > 90) {
    return NextResponse.json(
      { error: "路网矩阵每批需要 1–89 个有效点，且起终点合计不超过 90。" },
      { status: 400 },
    );
  }

  const endpoint =
    process.env.OSRM_TABLE_ENDPOINT?.trim() ||
    "https://router.project-osrm.org";
  if (!/^https?:\/\//i.test(endpoint)) {
    return NextResponse.json({ error: "OSRM endpoint 无效。" }, { status: 400 });
  }
  const points = [...sources, ...destinations].map((point) => {
    const normalized = point.coordinateSystem === "wgs84"
      ? point
      : gcj02ToWgs84(point);
    return { ...point, lat: normalized.lat, lng: normalized.lng };
  });
  const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(";");
  const sourceIndexes = sources.map((_, index) => index).join(";");
  const destinationIndexes = destinations
    .map((_, index) => sources.length + index)
    .join(";");
  const url = new URL(`/table/v1/driving/${coordinates}`, endpoint);
  url.searchParams.set("sources", sourceIndexes);
  url.searchParams.set("destinations", destinationIndexes);
  url.searchParams.set("annotations", "duration,distance");

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "UrbanHousingPlanningPrototype/1.0",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: `OSRM 返回 HTTP ${response.status}` },
        { status: 502 },
      );
    }
    const payload = (await response.json()) as {
      code?: string;
      message?: string;
      durations?: Array<Array<number | null>>;
      distances?: Array<Array<number | null>>;
    };
    if (payload.code !== "Ok" || !payload.durations) {
      return NextResponse.json(
        { error: payload.message || payload.code || "OSRM 未返回矩阵。" },
        { status: 502 },
      );
    }
    return NextResponse.json({
      source: endpoint.includes("router.project-osrm.org")
        ? "osrm_public_demo"
        : "osrm_custom",
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
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `OSRM 连接失败：${error.message}`
            : "OSRM 连接失败。",
      },
      { status: 502 },
    );
  }
}
