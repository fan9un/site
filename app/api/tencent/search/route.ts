import { NextRequest, NextResponse } from "next/server";

const housingKeywords = [
  "医院",
  "学校",
  "幼儿园",
  "公交站",
  "养老院",
  "托育",
  "菜市场",
  "公园",
  "商场",
  "餐厅",
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

  const key = body.key?.trim();
  const region = body.region?.trim();
  if (!key || !region) {
    return NextResponse.json(
      { error: "腾讯位置服务 Key 和区域不能为空" },
      { status: 400 },
    );
  }

  const keywords =
    body.mode === "worldcup" ? worldCupKeywords : housingKeywords;

  const results = await Promise.all(
    keywords.map(async (keyword) => {
      const url = new URL("https://apis.map.qq.com/ws/place/v1/search");
      url.searchParams.set("boundary", `region(${region},0)`);
      url.searchParams.set("keyword", keyword);
      url.searchParams.set("page_size", "20");
      url.searchParams.set("key", key);

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return { keyword, data: [] };
      }
      const payload = (await response.json()) as {
        status?: number;
        data?: Array<{
          id?: string;
          title?: string;
          address?: string;
          location?: { lat?: number; lng?: number };
          category?: string;
        }>;
      };
      return {
        keyword,
        data: payload.status === 0 ? payload.data ?? [] : [],
      };
    }),
  );

  const points = results.flatMap((result) =>
    result.data.map((item) => ({
      id: item.id,
      name: item.title,
      address: item.address,
      category: result.keyword,
      lat: item.location?.lat,
      lng: item.location?.lng,
    })),
  );

  return NextResponse.json({
    region,
    count: points.length,
    categories: results.map((result) => ({
      name: result.keyword,
      count: result.data.length,
    })),
    points,
  });
}
