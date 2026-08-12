import { wgs84ToGcj02 } from "./data-pipeline.ts";

export type MapPoiSource = "tencent" | "tianditu" | "cross_verified";

export type FusionPoi = {
  id?: string;
  name?: string;
  address?: string;
  category?: string;
  poiCategory?: string;
  lat: number;
  lng: number;
  source: MapPoiSource;
  sourceDetail?: string;
};

export type TiandituRawPoi = {
  hotPointID?: string;
  name?: string;
  address?: string;
  lonlat?: string;
  typeName?: string;
  county?: string;
  city?: string;
};

export function normalizePoiName(value = "") {
  return value
    .toLowerCase()
    .replace(/[\s·•（）()\-—_]/g, "")
    .replace(/厦门市|北京市|上海市|广州市|深圳市/g, "")
    .replace(/有限责任公司|有限公司|分公司|总院|本部/g, "");
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const radius = 6_371_000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

export function tiandituPoiToGcj02(
  point: TiandituRawPoi,
  category: string,
): FusionPoi | undefined {
  const [lngText, latText] = (point.lonlat ?? "").split(",");
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  const normalized = wgs84ToGcj02({ lat, lng });
  return {
    id: `tdt-${point.hotPointID ?? `${lngText}-${latText}`}`,
    name: point.name,
    address: point.address,
    category,
    poiCategory: point.typeName,
    lat: normalized.lat,
    lng: normalized.lng,
    source: "tianditu",
    sourceDetail: [point.city, point.county].filter(Boolean).join(" · "),
  };
}

function isLikelySamePoi(left: FusionPoi, right: FusionPoi) {
  if (haversineMeters(left, right) > 160) return false;
  const leftName = normalizePoiName(left.name);
  const rightName = normalizePoiName(right.name);
  if (!leftName || !rightName) return false;
  return (
    leftName === rightName ||
    (Math.min(leftName.length, rightName.length) >= 4 &&
      (leftName.includes(rightName) || rightName.includes(leftName)))
  );
}

export function fuseMapPois(
  tencentPoints: Array<Omit<FusionPoi, "source"> & { source?: MapPoiSource }>,
  tiandituPoints: FusionPoi[],
) {
  const fused: FusionPoi[] = tencentPoints.map((point) => ({
    ...point,
    source: point.source ?? "tencent",
  }));
  let crossVerifiedCount = 0;
  let supplementedCount = 0;

  tiandituPoints.forEach((point) => {
    const matchIndex = fused.findIndex((candidate) => isLikelySamePoi(candidate, point));
    if (matchIndex >= 0) {
      const previous = fused[matchIndex];
      fused[matchIndex] = {
        ...previous,
        source: "cross_verified",
        sourceDetail: "腾讯位置服务 + 天地图交叉确认",
        poiCategory: previous.poiCategory || point.poiCategory,
        address: previous.address || point.address,
      };
      crossVerifiedCount += 1;
      return;
    }
    fused.push(point);
    supplementedCount += 1;
  });

  return { points: fused, crossVerifiedCount, supplementedCount };
}
