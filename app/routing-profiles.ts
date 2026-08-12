export type RouteMatrixProfile = "driving" | "walking" | "cycling";

export const routeProfileOptions: Array<{
  value: RouteMatrixProfile;
  label: string;
  provider: string;
  quotaNote: string;
}> = [
  {
    value: "driving",
    label: "驾车（OSRM）",
    provider: "OSRM",
    quotaNote: "公共演示服务，不消耗 ORS 额度",
  },
  {
    value: "walking",
    label: "步行（ORS）",
    provider: "OpenRouteService",
    quotaNote: "按需请求，消耗 1 次矩阵额度",
  },
  {
    value: "cycling",
    label: "骑行（ORS）",
    provider: "OpenRouteService",
    quotaNote: "按需请求，消耗 1 次矩阵额度",
  },
];

export function routeProfileLabel(profile: RouteMatrixProfile) {
  return routeProfileOptions.find((option) => option.value === profile)?.label ?? profile;
}

export function openRouteServiceProfile(profile: RouteMatrixProfile) {
  if (profile === "walking") return "foot-walking";
  if (profile === "cycling") return "cycling-regular";
  return "driving-car";
}
