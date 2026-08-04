import { NextRequest, NextResponse } from "next/server";

const housingKeywords = [
  "住宅小区",
  "医院",
  "学校",
  "幼儿园",
  "公交站",
  "地铁站",
  "BRT",
  "轮渡码头",
  "公共自行车",
  "养老院",
  "托育",
  "菜市场",
  "公园",
  "商场",
  "餐厅",
  "图书馆",
  "派出所",
  "火车站",
  "写字楼",
  "产业园",
  "公司企业",
  "商务中心",
  "机场",
  "港口",
  "化工园",
  "垃圾处理",
  "污水处理厂",
  "铁路货运站",
];

const worldCupKeywords = [
  "酒店",
  "地铁站",
  "火车站",
  "医院",
  "餐厅",
  "停车场",
  "公共厕所",
  "体育场",
];

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    key?: string;
    region?: string;
    mode?: "housing" | "worldcup";
  };

  const keyCandidates = Array.from(
    new Set(
      [
        body.key?.trim(),
        process.env.TENCENT_MAP_SERVICE_KEY?.trim(),
        process.env.NEXT_PUBLIC_TENCENT_MAP_KEY?.trim(),
      ].filter((value): value is string => Boolean(value)),
    ),
  );
  const region = body.region?.trim();
  if (!keyCandidates.length || !region) {
    return NextResponse.json(
      { error: "腾讯位置服务 Key 和区域不能为空" },
      { status: 400 },
    );
  }

  const keywords =
    body.mode === "worldcup" ? worldCupKeywords : housingKeywords;

  let activeKeyIndex = 0;
  const fetchKeyword = async (keyword: string) => {
    let lastError = "api-error";
    for (let offset = 0; offset < keyCandidates.length; offset += 1) {
      const keyIndex = (activeKeyIndex + offset) % keyCandidates.length;
      const url = new URL("https://apis.map.qq.com/ws/place/v1/search");
      url.searchParams.set("boundary", `region(${region},2)`);
      url.searchParams.set("keyword", keyword);
      url.searchParams.set("page_size", "20");
      url.searchParams.set("key", keyCandidates[keyIndex]);

      let response: Response;
      try {
        response = await fetch(url, {
          headers: { Accept: "application/json" },
        });
      } catch {
        lastError = "network";
        continue;
      }
      if (!response.ok) {
        lastError = `http-${response.status}`;
        continue;
      }
      const payload = (await response.json()) as {
        status?: number;
        message?: string;
        data?: Array<{
          id?: string;
          title?: string;
          address?: string;
          location?: { lat?: number; lng?: number };
          category?: string;
        }>;
      };
      if (payload.status === 0) {
        activeKeyIndex = keyIndex;
        return { keyword, data: payload.data ?? [], error: undefined };
      }
      lastError = payload.message ?? "api-error";
    }
    return { keyword, data: [], error: lastError };
  };

  const results: Awaited<ReturnType<typeof fetchKeyword>>[] = [];
  for (let index = 0; index < keywords.length; index += 2) {
    const batch = await Promise.all(
      keywords.slice(index, index + 2).map(fetchKeyword),
    );
    results.push(...batch);
    if (index + 2 < keywords.length) {
      await new Promise((resolve) => setTimeout(resolve, 320));
    }
  }

  const rawPoints = results.flatMap((result) =>
    result.data.map((item) => ({
      id: item.id,
      name: item.title,
      address: item.address,
      category: result.keyword,
      poiCategory: item.category,
      lat: item.location?.lat,
      lng: item.location?.lng,
    })),
  );
  const pointIndex = new Map<string, (typeof rawPoints)[number]>();
  rawPoints.forEach((point) => {
    const id = point.id ?? `${point.name}-${point.lat}-${point.lng}`;
    const previous = pointIndex.get(id);
    if (!previous) {
      pointIndex.set(id, point);
      return;
    }
    const categories = new Set(
      `${previous.category}|${point.category}`.split("|").filter(Boolean),
    );
    pointIndex.set(id, {
      ...previous,
      category: Array.from(categories).join("|"),
    });
  });
  const points = Array.from(pointIndex.values());

  return NextResponse.json({
    region,
    count: points.length,
    categories: results.map((result) => ({
      name: result.keyword,
      count: result.data.length,
      error: result.error,
    })),
    points,
  });
}
