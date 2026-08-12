import type { RouteMatrixProfile } from "./routing-profiles";

export type TravelTimeMatrix = {
  source: "osrm_public_demo" | "osrm_custom" | "openrouteservice";
  profile: RouteMatrixProfile;
  durationsMinutes: Record<string, number>;
  distancesKm: Record<string, number>;
  generatedAt: string;
  destinationCount: number;
  note: string;
};

export type EmploymentFacilityInput = {
  id: string;
  lat: number;
  lng: number;
  capacity: number;
  quality: number;
  industryCategory?: string;
};

export type EmploymentOpportunityResult = {
  accessibility: number;
  diversity: number;
  categoryCount: number;
  accessibleJobs: number;
  usedRouteMatrix: boolean;
  diversitySource: "industry_data" | "fallback";
};

export type HedonicObservation = {
  zoneId: string;
  unitPrice: number;
  area: number;
  buildingAge: number;
  floorRatio: number;
  greenRatio: number;
  distanceCbdKm: number;
  transactionMonth: number;
  serviceValue: number;
};

export type HedonicAudit = {
  sampleSize: number;
  zoneCount: number;
  r2: number;
  adjustedR2: number;
  ridgeLambda: number;
  zoneResiduals: Record<string, number>;
  coefficients: Record<string, number>;
  note: string;
  isTemplate?: boolean;
};

export type TransactionCsvRow = Omit<HedonicObservation, "serviceValue"> & {
  zoneName?: string;
};

export type ImportedEnterprise = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  quality: number;
  industryCategory: string;
  usedProxyEmployment: boolean;
  sourceCoordinateSystem: "wgs84" | "gcj02";
};

export type ImportedLegalParcel = {
  id: string;
  name: string;
  center: { lat: number; lng: number };
  area: number;
  landPrice: number;
  landUse: "vacant" | "industrial_renewal" | "brownfield" | "greenfield";
  zoningAllowed: string[];
  demolitionDifficulty: number;
  policyCertainty: number;
  risk: number;
  approvalRef: string;
};

export function matrixKey(sourceId: string, destinationId: string) {
  return `${sourceId}::${destinationId}`;
}

const coordinatePi = Math.PI;
const coordinateA = 6378245;
const coordinateEccentricity = 0.006693421622965943;

function outsideChina(point: { lat: number; lng: number }) {
  return point.lng < 72.004 || point.lng > 137.8347 || point.lat < 0.8293 || point.lat > 55.8271;
}

function transformLatitude(x: number, y: number) {
  let result = -100 + 2 * x + 3 * y + 0.2 * y ** 2 + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  result += ((20 * Math.sin(6 * x * coordinatePi) + 20 * Math.sin(2 * x * coordinatePi)) * 2) / 3;
  result += ((20 * Math.sin(y * coordinatePi) + 40 * Math.sin((y / 3) * coordinatePi)) * 2) / 3;
  result += ((160 * Math.sin((y / 12) * coordinatePi) + 320 * Math.sin((y * coordinatePi) / 30)) * 2) / 3;
  return result;
}

function transformLongitude(x: number, y: number) {
  let result = 300 + x + 2 * y + 0.1 * x ** 2 + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  result += ((20 * Math.sin(6 * x * coordinatePi) + 20 * Math.sin(2 * x * coordinatePi)) * 2) / 3;
  result += ((20 * Math.sin(x * coordinatePi) + 40 * Math.sin((x / 3) * coordinatePi)) * 2) / 3;
  result += ((150 * Math.sin((x / 12) * coordinatePi) + 300 * Math.sin((x / 30) * coordinatePi)) * 2) / 3;
  return result;
}

export function wgs84ToGcj02(point: { lat: number; lng: number }) {
  if (outsideChina(point)) return { ...point };
  let latitudeDelta = transformLatitude(point.lng - 105, point.lat - 35);
  let longitudeDelta = transformLongitude(point.lng - 105, point.lat - 35);
  const latitudeRadians = (point.lat / 180) * coordinatePi;
  let magic = Math.sin(latitudeRadians);
  magic = 1 - coordinateEccentricity * magic ** 2;
  const rootMagic = Math.sqrt(magic);
  latitudeDelta = (latitudeDelta * 180) / (((coordinateA * (1 - coordinateEccentricity)) / (magic * rootMagic)) * coordinatePi);
  longitudeDelta = (longitudeDelta * 180) / ((coordinateA / rootMagic) * Math.cos(latitudeRadians) * coordinatePi);
  return { lat: point.lat + latitudeDelta, lng: point.lng + longitudeDelta };
}

export function gcj02ToWgs84(point: { lat: number; lng: number }) {
  if (outsideChina(point)) return { ...point };
  let estimate = { ...point };
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const transformed = wgs84ToGcj02(estimate);
    estimate = {
      lat: estimate.lat - (transformed.lat - point.lat),
      lng: estimate.lng - (transformed.lng - point.lng),
    };
  }
  return estimate;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const radius = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

export function classifyIndustry(value = "") {
  const normalized = value.toLowerCase();
  if (/软件|互联网|信息|通信|科技|数据|人工智能|it/.test(normalized)) return "数字与信息";
  if (/金融|银行|保险|证券|基金|投资/.test(normalized)) return "金融服务";
  if (/制造|工业|机械|电子|材料|汽车|能源|化工/.test(normalized)) return "制造与工业";
  if (/物流|货运|仓储|供应链|快递|运输/.test(normalized)) return "物流与运输";
  if (/教育|科研|学校|大学|研究/.test(normalized)) return "教育与科研";
  if (/医疗|健康|生物|医药|医院/.test(normalized)) return "医疗与生命科学";
  if (/商贸|零售|批发|电商|商业|餐饮|酒店|旅游/.test(normalized)) return "商贸与消费";
  if (/咨询|法律|会计|设计|广告|人力|专业服务/.test(normalized)) return "专业服务";
  if (/政府|公共|事业单位|社会组织/.test(normalized)) return "公共与社会服务";
  return "其他行业";
}

export function employmentOpportunityIndex(args: {
  zone: { id: string; lat: number; lng: number };
  facilities: EmploymentFacilityInput[];
  workingPopulation: number;
  routeMatrix?: TravelTimeMatrix;
  fallbackAccessibility?: number;
  fallbackDiversity?: number;
}): EmploymentOpportunityResult {
  const {
    zone,
    facilities,
    workingPopulation,
    routeMatrix,
    fallbackAccessibility = 50,
    fallbackDiversity = 45,
  } = args;
  if (!facilities.length) {
    return {
      accessibility: fallbackAccessibility,
      diversity: fallbackDiversity,
      categoryCount: 0,
      accessibleJobs: 0,
      usedRouteMatrix: false,
      diversitySource: "fallback",
    };
  }

  const jobsByIndustry = new Map<string, number>();
  let accessibleJobs = 0;
  let classifiedJobs = 0;
  let usedRouteMatrix = false;
  facilities.forEach((facility) => {
    const routeMinutes = routeMatrix?.durationsMinutes[matrixKey(zone.id, facility.id)];
    const impedance = Number.isFinite(routeMinutes)
      ? 1 / (1 + (routeMinutes / 30) ** 2)
      : 1 / (1 + (haversine(zone, facility) / 7.5) ** 2);
    if (Number.isFinite(routeMinutes)) usedRouteMatrix = true;
    const weightedJobs = Math.max(0, facility.capacity) * clamp(facility.quality, 0, 1) * impedance;
    accessibleJobs += weightedJobs;
    if (facility.industryCategory) {
      classifiedJobs += weightedJobs;
      jobsByIndustry.set(
        facility.industryCategory,
        (jobsByIndustry.get(facility.industryCategory) ?? 0) + weightedJobs,
      );
    }
  });

  const jobsPerWorker = accessibleJobs / Math.max(1, workingPopulation);
  const accessibility = clamp(
    100 / (1 + Math.exp(-(jobsPerWorker - 0.42) / 0.16)),
    0,
    100,
  );
  if (classifiedJobs <= 0) {
    return {
      accessibility,
      diversity: fallbackDiversity,
      categoryCount: 0,
      accessibleJobs,
      usedRouteMatrix,
      diversitySource: "fallback",
    };
  }
  const positiveJobs = [...jobsByIndustry.values()].filter((value) => value > 0);
  const categoryCount = positiveJobs.length;
  if (categoryCount <= 1 || accessibleJobs <= 0) {
    return {
      accessibility,
      diversity: categoryCount === 1 ? 8 : 0,
      categoryCount,
      accessibleJobs,
      usedRouteMatrix,
      diversitySource: "industry_data",
    };
  }
  const shares = positiveJobs.map((value) => value / classifiedJobs);
  const shannon = -shares.reduce((sum, share) => sum + share * Math.log(share), 0);
  const normalizedShannon = shannon / Math.log(categoryCount);
  const hhi = shares.reduce((sum, share) => sum + share ** 2, 0);
  const breadth = Math.min(1, categoryCount / 6);
  const diversity = clamp(
    100 * (normalizedShannon * 0.55 + (1 - hhi) * 0.25 + breadth * 0.2),
    0,
    100,
  );
  return {
    accessibility,
    diversity,
    categoryCount,
    accessibleJobs,
    usedRouteMatrix,
    diversitySource: "industry_data",
  };
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error("CSV 至少需要表头和一行数据。 ");
  const headers = rows[0].map((header) => header.replace(/^\ufeff/, "").trim().toLowerCase());
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function pick(row: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[alias.toLowerCase()];
    if (value !== undefined && value !== "") return value;
  }
  return "";
}

function numberValue(row: Record<string, string>, aliases: string[]) {
  const raw = pick(row, aliases).replace(/[,，%％]/g, "");
  return Number(raw);
}

export function parseEnterpriseCsv(text: string): ImportedEnterprise[] {
  const rows = parseCsv(text);
  const facilities = rows.flatMap((row, index) => {
    const lat = numberValue(row, ["lat", "latitude", "纬度"]);
    const lng = numberValue(row, ["lng", "lon", "longitude", "经度"]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return [];
    const employeeValue = numberValue(row, ["employees", "jobs", "employee_count", "员工数", "从业人数", "岗位数"]);
    const usedProxyEmployment = !Number.isFinite(employeeValue) || employeeValue <= 0;
    const industryRaw = pick(row, ["industry", "industry_category", "行业", "行业门类", "经营范围"]);
    const coordinateSystemRaw = pick(row, ["coordinate_system", "coord_system", "坐标系"]).toLowerCase();
    const sourceCoordinateSystem = /gcj|高德|腾讯|火星/.test(coordinateSystemRaw)
      ? "gcj02" as const
      : "wgs84" as const;
    const canonicalPoint = sourceCoordinateSystem === "gcj02"
      ? { lat, lng }
      : wgs84ToGcj02({ lat, lng });
    return [{
      id: pick(row, ["id", "enterprise_id", "统一社会信用代码", "企业id"]) || `enterprise-${index + 1}`,
      name: pick(row, ["name", "enterprise_name", "企业名称", "名称"]) || `企业 ${index + 1}`,
      lat: canonicalPoint.lat,
      lng: canonicalPoint.lng,
      capacity: usedProxyEmployment ? 80 : employeeValue,
      quality: 0.86,
      industryCategory: classifyIndustry(industryRaw),
      usedProxyEmployment,
      sourceCoordinateSystem,
    }];
  });
  if (!facilities.length) throw new Error("企业 CSV 中没有有效坐标；需要 name、lat、lng、industry、employees，可选 coordinate_system=wgs84/gcj02。 ");
  return facilities;
}

function monthNumber(value: string) {
  const match = value.match(/(20\d{2})[-/.年](\d{1,2})/);
  if (match) return Number(match[1]) * 12 + Number(match[2]);
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function parseTransactionCsv(text: string): TransactionCsvRow[] {
  const rows = parseCsv(text);
  const observations = rows.flatMap((row) => {
    const unitPrice = numberValue(row, ["unit_price", "price_per_sqm", "成交单价", "单价"]);
    const area = numberValue(row, ["area", "building_area", "面积", "建筑面积"]);
    const buildingAge = numberValue(row, ["building_age", "age", "房龄"]);
    const floorRatio = numberValue(row, ["floor_ratio", "far", "容积率"]);
    let greenRatio = numberValue(row, ["green_ratio", "greening_rate", "绿化率"]);
    const distanceCbdKm = numberValue(row, ["distance_cbd_km", "cbd_distance", "距cbd公里", "距市中心公里"]);
    const transactionMonth = monthNumber(pick(row, ["transaction_month", "month", "成交月份", "成交日期"]));
    if (greenRatio > 1) greenRatio /= 100;
    if (
      !Number.isFinite(unitPrice) || unitPrice < 1000 || unitPrice > 300000 ||
      !Number.isFinite(area) || area < 10 || area > 1000 ||
      !Number.isFinite(buildingAge) || buildingAge < 0 || buildingAge > 150 ||
      !Number.isFinite(floorRatio) || floorRatio < 0 || floorRatio > 20 ||
      !Number.isFinite(greenRatio) || greenRatio < 0 || greenRatio > 1 ||
      !Number.isFinite(distanceCbdKm) || distanceCbdKm < 0 || distanceCbdKm > 200 ||
      !Number.isFinite(transactionMonth) || transactionMonth <= 0
    ) return [];
    return [{
      zoneId: pick(row, ["zone_id", "community_id", "小区id", "居住区id"]),
      zoneName: pick(row, ["zone_name", "community", "community_name", "小区", "小区名称", "居住区"]),
      unitPrice,
      area,
      buildingAge,
      floorRatio,
      greenRatio,
      distanceCbdKm,
      transactionMonth,
    }];
  });
  if (!observations.length) {
    throw new Error("成交 CSV 缺少有效记录；请检查小区、成交单价、面积、房龄、容积率、绿化率、距 CBD 和成交月份。 ");
  }
  return observations;
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    if (Math.abs(divisor) < 1e-10) throw new Error("享乐模型矩阵不可逆，请增加样本或检查重复字段。 ");
    for (let item = column; item <= size; item += 1) augmented[column][item] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let item = column; item <= size; item += 1) {
        augmented[row][item] -= factor * augmented[column][item];
      }
    }
  }
  return augmented.map((row) => row[size]);
}

export function fitHedonicModel(
  observations: HedonicObservation[],
  ridgeLambda = 0.35,
): HedonicAudit {
  const predictorNames = [
    "lnArea",
    "buildingAge",
    "floorRatio",
    "greenRatio",
    "distanceCbdKm",
    "transactionMonth",
    "serviceValue",
  ];
  if (observations.length < 30) throw new Error("享乐价格模型至少需要 30 条已匹配成交记录。 ");
  if (new Set(observations.map((row) => row.zoneId)).size < 3) {
    throw new Error("享乐价格模型至少需要覆盖 3 个小区。 ");
  }
  const rawX = observations.map((row) => [
    Math.log(row.area),
    row.buildingAge,
    row.floorRatio,
    row.greenRatio,
    row.distanceCbdKm,
    row.transactionMonth,
    row.serviceValue,
  ]);
  const means = predictorNames.map((_, column) =>
    rawX.reduce((sum, row) => sum + row[column], 0) / rawX.length,
  );
  const deviations = predictorNames.map((_, column) => {
    const variance = rawX.reduce((sum, row) => sum + (row[column] - means[column]) ** 2, 0) / rawX.length;
    return Math.sqrt(variance) || 1;
  });
  const x = rawX.map((row) => [1, ...row.map((value, column) => (value - means[column]) / deviations[column])]);
  const y = observations.map((row) => Math.log(row.unitPrice));
  const width = x[0].length;
  const xtx = Array.from({ length: width }, (_, row) =>
    Array.from({ length: width }, (_, column) =>
      x.reduce((sum, values) => sum + values[row] * values[column], 0) +
      (row === column && row > 0 ? ridgeLambda : 0),
    ),
  );
  const xty = Array.from({ length: width }, (_, column) =>
    x.reduce((sum, values, row) => sum + values[column] * y[row], 0),
  );
  const beta = solveLinearSystem(xtx, xty);
  const fitted = x.map((row) => row.reduce((sum, value, column) => sum + value * beta[column], 0));
  const yMean = y.reduce((sum, value) => sum + value, 0) / y.length;
  const residuals = y.map((value, index) => value - fitted[index]);
  const sse = residuals.reduce((sum, value) => sum + value ** 2, 0);
  const sst = y.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  const r2 = sst > 0 ? clamp(1 - sse / sst, -1, 1) : 0;
  const adjustedR2 = 1 - (1 - r2) * ((y.length - 1) / Math.max(1, y.length - width));
  const residualGroups = new Map<string, number[]>();
  observations.forEach((row, index) => {
    const values = residualGroups.get(row.zoneId) ?? [];
    values.push(residuals[index]);
    residualGroups.set(row.zoneId, values);
  });
  const zoneResiduals = Object.fromEntries(
    [...residualGroups.entries()].map(([zoneId, values]) => {
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      return [zoneId, Math.exp(mean) - 1];
    }),
  );
  return {
    sampleSize: observations.length,
    zoneCount: residualGroups.size,
    r2,
    adjustedR2,
    ridgeLambda,
    zoneResiduals,
    coefficients: Object.fromEntries(["intercept", ...predictorNames].map((name, index) => [name, beta[index]])),
    note: "对数成交单价采用岭回归，控制面积、房龄、容积率、绿化率、距 CBD、成交月份和公共服务价值；小区残差为控制后价格偏离。",
  };
}

function polygonCentroid(coordinates: unknown) {
  const points: Array<[number, number]> = [];
  const collect = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      points.push([value[0], value[1]]);
      return;
    }
    value.forEach(collect);
  };
  collect(coordinates);
  if (!points.length) throw new Error("控规 GeoJSON 存在空几何。 ");
  return {
    lng: points.reduce((sum, point) => sum + point[0], 0) / points.length,
    lat: points.reduce((sum, point) => sum + point[1], 0) / points.length,
  };
}

function normalizedAllowed(value: unknown) {
  const values = Array.isArray(value) ? value.map(String) : String(value ?? "").split(/[|,，;；]/);
  const aliases: Record<string, string> = {
    medical: "medical", 医疗: "medical", 卫生: "medical",
    education: "education", 教育: "education", 学校: "education",
    transit: "transit", 交通: "transit", 公交: "transit",
    care: "care", 养老: "care", 托育: "care",
    retail: "retail", 商业: "retail", 零售: "retail",
    green: "green", 绿地: "green", 公园: "green",
    culture: "culture", 文化: "culture",
    dining: "dining", 餐饮: "dining",
    safety: "safety", 安全: "safety", 应急: "safety",
  };
  return Array.from(new Set(values.map((item) => aliases[item.trim().toLowerCase()] ?? aliases[item.trim()]).filter(Boolean)));
}

export function parseLegalParcelGeoJson(text: string): ImportedLegalParcel[] {
  const payload = JSON.parse(text) as { type?: string; features?: Array<{ id?: string | number; geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> }> };
  if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
    throw new Error("控规文件必须是 GeoJSON FeatureCollection。 ");
  }
  const parcels = payload.features.flatMap((feature, index) => {
    if (!feature.geometry || !["Polygon", "MultiPolygon"].includes(feature.geometry.type ?? "")) return [];
    const properties = feature.properties ?? {};
    const status = String(properties.legal_status ?? properties.status ?? properties.法定状态 ?? "");
    const approvalRef = String(properties.approval_ref ?? properties.approval_no ?? properties.批准文号 ?? "").trim();
    if (
      !/approved|legal|current|已批|法定|现行/i.test(status) ||
      !approvalRef ||
      /示例|demo|sample|请替换/i.test(approvalRef)
    ) return [];
    const zoningAllowed = normalizedAllowed(properties.zoning_allowed ?? properties.allowed_facilities ?? properties.允许设施);
    const area = Number(properties.area_ha ?? properties.面积公顷);
    const landPrice = Number(properties.land_price_10k_per_mu ?? properties.land_price ?? properties.万元每亩);
    if (!zoningAllowed.length || !Number.isFinite(area) || area <= 0 || !Number.isFinite(landPrice) || landPrice < 0) return [];
    const rawCenter = polygonCentroid(feature.geometry.coordinates);
    const coordinateSystem = String(properties.coordinate_system ?? properties.coord_system ?? properties.坐标系 ?? "wgs84");
    const center = /gcj|高德|腾讯|火星/i.test(coordinateSystem)
      ? rawCenter
      : wgs84ToGcj02(rawCenter);
    const landUseRaw = String(properties.land_use ?? properties.用地现状 ?? "vacant");
    const landUse = /industrial|工业更新/.test(landUseRaw)
      ? "industrial_renewal"
      : /brownfield|棕地/.test(landUseRaw)
        ? "brownfield"
        : /greenfield|新增建设/.test(landUseRaw)
          ? "greenfield"
          : "vacant";
    return [{
      id: String(properties.parcel_id ?? properties.id ?? feature.id ?? `legal-parcel-${index + 1}`),
      name: String(properties.name ?? properties.地块名称 ?? `法定地块 ${index + 1}`),
      center,
      area,
      landPrice,
      landUse: landUse as ImportedLegalParcel["landUse"],
      zoningAllowed,
      demolitionDifficulty: clamp(Number(properties.demolition_difficulty ?? properties.拆迁难度 ?? 0.25), 0, 1),
      policyCertainty: clamp(Number(properties.policy_certainty ?? properties.政策确定性 ?? 0.95), 0, 1),
      risk: clamp(Number(properties.risk ?? properties.综合风险 ?? 0.15), 0, 1),
      approvalRef,
    }];
  });
  if (!parcels.length) {
    throw new Error("未发现可用法定地块；每个面要含 legal_status=approved/法定、approval_ref、area_ha、land_price_10k_per_mu 和 zoning_allowed。 ");
  }
  return parcels;
}
