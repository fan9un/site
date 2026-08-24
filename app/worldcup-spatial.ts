export type WorldCupCapacityChain = "交通" | "住宿" | "餐饮" | "医疗" | "公卫";

export const worldCupChainRadiusKm: Record<WorldCupCapacityChain, number> = {
  交通: 24,
  住宿: 14,
  餐饮: 6,
  医疗: 16,
  公卫: 5,
};

export const worldCupChainTimeMinutes: Record<WorldCupCapacityChain, number> = {
  交通: 48,
  住宿: 38,
  餐饮: 24,
  医疗: 26,
  公卫: 18,
};

export function worldCupChainForPoi(description = ""): WorldCupCapacityChain | undefined {
  if (/酒店|宾馆|旅馆/.test(description)) return "住宿";
  if (/地铁|火车|公交|汽车站|机场|停车场/.test(description)) return "交通";
  if (/医院|急救/.test(description)) return "医疗";
  if (/餐厅|商场|商业/.test(description)) return "餐饮";
  if (/公共厕所/.test(description)) return "公卫";
  return undefined;
}

export function worldCupNominalCapacity(description = "") {
  if (/酒店|宾馆|旅馆/.test(description)) return 180;
  if (/地铁/.test(description)) return 12_000;
  if (/火车/.test(description)) return 16_000;
  if (/机场/.test(description)) return 22_000;
  if (/公交|汽车站/.test(description)) return 8_000;
  if (/停车场/.test(description)) return 2_200;
  if (/医院/.test(description)) return 4_500;
  if (/急救/.test(description)) return 2_500;
  if (/商场|商业/.test(description)) return 2_500;
  if (/餐厅/.test(description)) return 350;
  if (/公共厕所/.test(description)) return 900;
  return 0;
}

export function isWorldCupStadiumDescription(description = "") {
  return /体育场|足球场|体育中心|运动场/.test(description);
}

export function worldCupAccessibility(
  chain: WorldCupCapacityChain,
  distanceKm: number,
  routeMinutes?: number,
) {
  if (typeof routeMinutes === "number") {
    return Math.exp(-0.5 * (routeMinutes / worldCupChainTimeMinutes[chain]) ** 2);
  }
  return Math.exp(-distanceKm / worldCupChainRadiusKm[chain]);
}
