export type ModelCoord = { lat: number; lng: number };

export type CompetitionZone = {
  id: string;
  coord: ModelCoord;
  demand: number;
};

export type CompetitionFacility = {
  coord: ModelCoord;
  supply: number;
};

function haversine(a: ModelCoord, b: ModelCoord) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(value));
}

export function competitiveAccessibility(
  targetId: string,
  zones: CompetitionZone[],
  facilities: CompetitionFacility[],
  distanceWeight: (distanceKm: number) => number,
) {
  const target = zones.find((zone) => zone.id === targetId);
  if (!target) return 0;
  return facilities.reduce((sum, facility) => {
    const catchmentDemand = zones.reduce(
      (demand, zone) =>
        demand +
        Math.max(0, zone.demand) *
          distanceWeight(haversine(zone.coord, facility.coord)),
      0,
    );
    const targetWeight = distanceWeight(haversine(target.coord, facility.coord));
    return sum + (Math.max(0, facility.supply) / Math.max(0.2, catchmentDemand)) * targetWeight;
  }, 0);
}

export function weightedRiskMultiplier(risks: Record<string, number>) {
  const weights: Record<string, number> = {
    geological: 0.15,
    flood: 0.25,
    pollution: 0.25,
    industrial: 0.2,
    noise: 0.15,
  };
  const weightedExposure = Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + Math.max(0, Math.min(1, risks[key] ?? 0)) * weight,
    0,
  );
  const maximumExposure = Math.max(
    0,
    ...Object.keys(weights).map((key) => Math.max(0, Math.min(1, risks[key] ?? 0))),
  );
  const combinedRisk = maximumExposure * 0.55 + weightedExposure * 0.45;
  return Math.max(0.55, 1 - combinedRisk * 0.45);
}

export function standardizedIndex(value: number, values: number[]) {
  if (values.length < 3) return 50;
  const mean = values.reduce((sum, item) => sum + item, 0) / values.length;
  const variance =
    values.reduce((sum, item) => sum + (item - mean) ** 2, 0) / values.length;
  const deviation = Math.sqrt(variance);
  if (!Number.isFinite(deviation) || deviation < 0.0001) return 50;
  return Math.max(5, Math.min(95, 50 + ((value - mean) / deviation) * 15));
}

export function explainPriceResidual(residual: number) {
  if (residual > 8) {
    return "价格显著高于公共服务价值的同城标准化位置。应优先核验房龄、产品品质、学区预期、景观稀缺性和交易时点；当前数据不能把差异直接归因于投机溢价。";
  }
  if (residual < -8) {
    return "公共服务价值显著高于价格的同城标准化位置。应核验住房品质、环境污名、供应结构和更新时滞；该差异不等于确定的市场低估。";
  }
  return "公共服务价值与价格在同城样本中的相对位置接近；仍需用带房屋属性和月份控制的成交模型做正式验证。";
}
