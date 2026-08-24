"use client";

import {
  ChangeEvent,
  FormEvent,
  type CSSProperties,
  useMemo,
  useState,
} from "react";
import {
  Activity,
  Baby,
  BedDouble,
  BriefcaseBusiness,
  Building2,
  BusFront,
  CloudSun,
  Dumbbell,
  Factory,
  GraduationCap,
  Hospital,
  Landmark,
  Leaf,
  LibraryBig,
  MapPinned,
  PackageCheck,
  Route,
  School,
  ShieldCheck,
  ShoppingBasket,
  ShoppingBag,
  Store,
  TrainFront,
  TreePine,
  TrendingUp,
  University,
  UsersRound,
  Utensils,
  Waves,
  Wifi,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { assessCandidateSuitability, constraintLabels } from "./siting-constraints";
import {
  competitiveAccessibility,
  explainPriceResidual,
  standardizedIndex,
  weightedRiskMultiplier,
} from "./model-validation";
import {
  employmentOpportunityIndex,
  fitHedonicModel,
  matrixKey,
  parseEnterpriseCsv,
  parseLegalParcelGeoJson,
  parseTransactionCsv,
  type HedonicAudit,
  type TravelTimeMatrix,
} from "./data-pipeline";
import TencentPlanningMap, {
  type PlanningMapPoint,
} from "./TencentPlanningMap";
import { fuseMapPois, type MapPoiSource } from "./map-fusion";
import {
  routeProfileLabel,
  routeProfileOptions,
  type RouteMatrixProfile,
} from "./routing-profiles";
import {
  isWorldCupStadiumDescription,
  worldCupAccessibility,
  worldCupChainForPoi,
  worldCupChainRadiusKm,
  worldCupNominalCapacity,
} from "./worldcup-spatial";

type Mode = "housing" | "worldcup";
type MetricMap = Record<string, number>;
type HousingRing = "inner" | "middle" | "outer";
type MapScale = "local" | "city" | "region";
type MapView = "real" | "schematic";
type Coord = { lat: number; lng: number };
type DecayType = "gaussian" | "exponential" | "gravity";
type TransportMode =
  | "walk"
  | "bike"
  | "bus"
  | "brt"
  | "metro"
  | "road"
  | "ferry"
  | "rail";

type Demographics = {
  elderlyRatio: number;
  childRatio: number;
  workingAgeRatio: number;
  avgIncome: number;
};

type RiskProfile = {
  geological: number;
  flood: number;
  pollution: number;
  industrial: number;
  noise: number;
};

type HousingZone = {
  id: string;
  name: string;
  subtitle: string;
  coord: Coord;
  population: number;
  annualGrowth: number;
  demographics: Demographics;
  price: number;
  priceReason: string;
  risks: RiskProfile;
  metrics: MetricMap;
};

type Facility = Coord & {
  id: string;
  type: string;
  name: string;
  capacity: number;
  quality: number;
  openingYear: number;
  closingYear?: number;
  lifecycleSource?: "demo" | "tencent_poi" | "planning" | "manual" | "optimizer";
  mapSource?: MapPoiSource;
  transportMode?: TransportMode;
  industryCategory?: string;
  employmentSource?: "poi_proxy" | "enterprise_csv" | "qcc_calibrated";
};

type TencentPoi = {
  id?: string;
  name?: string;
  address?: string;
  category?: string;
  poiCategory?: string;
  lat: number;
  lng: number;
  source?: MapPoiSource;
  sourceDetail?: string;
};

type ConstraintKind =
  | "airport"
  | "port"
  | "industrial"
  | "waste"
  | "wastewater"
  | "freight";

type SiteConstraint = Coord & {
  id: string;
  name: string;
  kind: ConstraintKind;
};

type AnalysisScenario = {
  region: string;
  center: Coord;
  zones: HousingZone[];
  facilities: Facility[];
  constraints: SiteConstraint[];
  parcels: LandParcel[];
  regionalContext: MetricMap;
  hasMarketPrices: boolean;
  isImported: boolean;
  employmentPoiCount: number;
  estimatedJobs: number | null;
  employmentDataStatus: "none" | "demo" | "poi_proxy" | "enterprise" | "qcc" | "template";
  employmentCalibration?: {
    matched: number;
    disclosedEmployees: number;
    insuredProxy: number;
    ambiguous: number;
    unavailable: number;
  };
  routeMatrix?: TravelTimeMatrix;
  hedonicAudit?: HedonicAudit;
  parcelDataStatus: "none" | "demo" | "proxy" | "legal";
  dataNote: string;
};

type LandParcel = {
  id: string;
  name: string;
  center: Coord;
  area: number;
  landPrice: number;
  landUse: "vacant" | "industrial_renewal" | "brownfield" | "greenfield";
  zoningAllowed: string[];
  demolitionDifficulty: number;
  policyCertainty: number;
  risk: number;
};

type GeneratedCandidate = {
  id: string;
  parcelId: string;
  parcelName: string;
  factor: string;
  facility: string;
  center: Coord;
  capacity: number;
  quality: number;
  openingYear: number;
  cost: number;
  robustness: number;
  suitabilityScore: number;
  constraintVerified: boolean;
  constraintNotes: string[];
  nearestZoneId: string;
};

type Stadium = {
  id: string;
  name: string;
  city: string;
  capacity: number;
  coord?: Coord;
  dataSource?: "demo" | "manual" | "map_import";
  mapSource?: MapPoiSource;
  metrics: MetricMap;
  limits: {
    交通: number;
    住宿: number;
    餐饮: number;
    医疗: number;
    公卫: number;
  };
};

type MatchScenarioKey = "group" | "knockout" | "final";

type StadiumIntervention = {
  id: string;
  appliesTo: string[];
  type: string;
  title: string;
  place: string;
  cost: number;
  constructionYears: number;
  capacityGain: Partial<Stadium["limits"]>;
  legacyAnnualValue: number;
  reuseRate: number;
  idlenessRisk: number;
};

type WorldCupChain = keyof Stadium["limits"];

type ManualWorldCupFacility = {
  id: string;
  stadiumId: string;
  name: string;
  chain: WorldCupChain;
  capacity: number;
  coord: Coord;
  source: "manual" | MapPoiSource;
  routeMinutes?: number;
  distanceKm?: number;
};

type Recommendation = {
  rank: number;
  type: string;
  title: string;
  place: string;
  impact: string;
  detail: string;
  score: number;
  scoreLabel?: string;
  tone: "lime" | "coral" | "blue";
  sourceId?: string;
};

type PortfolioEvaluation = {
  scores: number[];
  equityScores: number[];
  efficiencyBenefit: number;
  equityBenefit: number;
  lifecycleCost: number;
  robustnessPenalty: number;
  objective: number;
  fairness: number;
};

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
};

const housingFactors = [
  { key: "medical", label: "基层医疗", short: "医", weight: 13, radius: "≤ 1km", ring: "inner" },
  { key: "education", label: "基础教育", short: "学", weight: 11, radius: "≤ 500m", ring: "inner" },
  { key: "transit", label: "公交可达", short: "行", weight: 10, radius: "≤ 1km", ring: "inner" },
  { key: "care", label: "养老托育", short: "护", weight: 10, radius: "≤ 300m", ring: "inner" },
  { key: "retail", label: "日常购物", short: "购", weight: 9, radius: "≤ 500m", ring: "inner" },
  { key: "green", label: "公园绿地", short: "园", weight: 8, radius: "≤ 1km", ring: "inner" },
  { key: "culture", label: "文化休闲", short: "文", weight: 7, radius: "≤ 1km", ring: "inner" },
  { key: "dining", label: "餐饮服务", short: "食", weight: 5, radius: "≤ 300m", ring: "inner" },
  { key: "safety", label: "社区安全", short: "安", weight: 5, radius: "≤ 1km", ring: "inner" },

  { key: "commerce", label: "大型商业", short: "商", weight: 7, radius: "≤ 5km", ring: "middle" },
  { key: "employment", label: "岗位可达", short: "业", weight: 7, radius: "30 分钟", ring: "middle" },
  { key: "employmentDiversity", label: "就业多样性", short: "多", weight: 4, radius: "30 分钟", ring: "middle" },
  { key: "tertiaryMedical", label: "三甲医院", short: "院", weight: 5, radius: "≤ 8km", ring: "middle" },
  { key: "higherEducation", label: "高校资源", short: "校", weight: 3, radius: "≤ 8km", ring: "middle" },
  { key: "regionalTransit", label: "轨道枢纽", short: "轨", weight: 5, radius: "≤ 5km", ring: "middle" },
  { key: "publicService", label: "公共服务", short: "政", weight: 4, radius: "区级", ring: "middle" },
  { key: "logistics", label: "物流配送", short: "配", weight: 2, radius: "≤ 5km", ring: "middle" },
  { key: "sports", label: "大型场馆", short: "体", weight: 2, radius: "≤ 5km", ring: "middle" },
  { key: "digital", label: "数字设施", short: "网", weight: 3, radius: "全区", ring: "middle" },

  { key: "policy", label: "政策潜力", short: "策", weight: 6, radius: "城市级", ring: "outer" },
  { key: "regionalGrowth", label: "区域增长", short: "增", weight: 4, radius: "都市圈", ring: "outer" },
  { key: "air", label: "空气质量", short: "气", weight: 3, radius: "城市级", ring: "outer" },
  { key: "ecology", label: "生态廊道", short: "生", weight: 3, radius: "城市级", ring: "outer" },
  { key: "industry", label: "工业环境", short: "工", weight: 3, radius: "城市级", ring: "outer" },
  { key: "hazard", label: "灾害韧性", short: "韧", weight: 3, radius: "城市级", ring: "outer" },
  { key: "demographics", label: "人口结构", short: "人", weight: 2, radius: "区级", ring: "outer" },
  { key: "climate", label: "气候适应", short: "候", weight: 2, radius: "城市级", ring: "outer" },
  { key: "heritage", label: "历史文化", short: "史", weight: 1, radius: "城市级", ring: "outer" },
] as const;

const housingRingMix: Record<HousingRing, number> = {
  inner: 0.7,
  middle: 0.2,
  outer: 0.1,
};

const regionalContextMetrics: MetricMap = {
  policy: 73,
  regionalGrowth: 78,
  air: 66,
  ecology: 74,
  industry: 64,
  hazard: 71,
  demographics: 69,
  climate: 70,
  heritage: 82,
};

const ringNames: Record<HousingRing, string> = {
  inner: "内圈 · 日常服务",
  middle: "中圈 · 城市结构",
  outer: "区域层 · 共享背景",
};

const mapScales: Record<
  MapScale,
  {
    label: string;
    location: string;
    title: string;
    range: string;
    ring: HousingRing;
    note: string;
  }
> = {
  local: {
    label: "近邻层",
    location: "厦门 · 湖里区模拟片区",
    title: "社区设施精细评估",
    range: "约 0–3km",
    ring: "inner",
    note: "显示学校、基层医疗、托育、菜场、公园等高频设施",
  },
  city: {
    label: "城市层",
    location: "厦门市 · 跨区影响",
    title: "城市结构与高等级服务",
    range: "约 3–30km",
    ring: "middle",
    note: "只保留岗位中心、三甲医院、高校、商圈与综合枢纽",
  },
  region: {
    label: "区域层",
    location: "福建省 · 厦漳泉都市圈",
    title: "都市圈与省域联系",
    range: "约 30–300km",
    ring: "outer",
    note: "同一城区共享背景值；用于跨城市比较、新城选址与长期情景，不参与区内公平排序",
  },
};

const factorIcons: Record<string, LucideIcon> = {
  medical: Activity,
  education: School,
  transit: BusFront,
  care: Baby,
  retail: ShoppingBasket,
  green: TreePine,
  culture: LibraryBig,
  dining: Utensils,
  safety: ShieldCheck,
  commerce: ShoppingBag,
  employment: BriefcaseBusiness,
  employmentDiversity: Building2,
  tertiaryMedical: Hospital,
  higherEducation: GraduationCap,
  regionalTransit: TrainFront,
  publicService: Landmark,
  logistics: PackageCheck,
  sports: Dumbbell,
  digital: Wifi,
  policy: Building2,
  regionalGrowth: TrendingUp,
  air: Wind,
  ecology: Leaf,
  industry: Factory,
  hazard: Waves,
  demographics: UsersRound,
  climate: CloudSun,
  heritage: University,
  lodging: BedDouble,
  egress: Route,
  sanitary: Store,
  security: ShieldCheck,
};

const cupFactors = [
  { key: "transit", label: "交通疏散", short: "运", weight: 22, radius: "赛后 90 分钟" },
  { key: "lodging", label: "旅馆床位", short: "宿", weight: 18, radius: "≤ 5km" },
  { key: "egress", label: "人流组织", short: "流", weight: 14, radius: "≤ 1km" },
  { key: "medical", label: "医疗急救", short: "救", weight: 10, radius: "≤ 15 分钟" },
  { key: "dining", label: "餐饮供给", short: "食", weight: 8, radius: "≤ 2km" },
  { key: "sanitary", label: "公卫设施", short: "卫", weight: 8, radius: "步行圈" },
  { key: "security", label: "安保应急", short: "安", weight: 8, radius: "分区响应" },
  { key: "digital", label: "数字通信", short: "网", weight: 6, radius: "全覆盖" },
  { key: "climate", label: "气候韧性", short: "候", weight: 4, radius: "赛事期" },
  { key: "commerce", label: "商业活力", short: "娱", weight: 2, radius: "≤ 3km" },
] as const;

const housingZones: HousingZone[] = [
  {
    id: "beiyuan",
    name: "北园新城",
    subtitle: "高密居住 · 老少比 0.41",
    coord: { lat: 24.535, lng: 118.13 },
    population: 8.6,
    annualGrowth: 0.018,
    demographics: { elderlyRatio: 0.12, childRatio: 0.14, workingAgeRatio: 0.69, avgIncome: 0.82 },
    price: 4.2,
    priceReason: "次新房供给偏少、开发商品牌和学区预期形成市场溢价，房价高于公共服务模型所能解释的部分。",
    risks: { geological: 0.08, flood: 0.12, pollution: 0.08, industrial: 0.1, noise: 0.22 },
    metrics: {
      medical: 82,
      education: 76,
      transit: 88,
      care: 63,
      retail: 84,
      green: 71,
      culture: 65,
      dining: 86,
      safety: 81,
      commerce: 79,
      employment: 73,
      tertiaryMedical: 76,
      higherEducation: 62,
      regionalTransit: 86,
      publicService: 74,
      logistics: 77,
      sports: 63,
      digital: 91,
      policy: 72,
      regionalGrowth: 78,
      air: 61,
      ecology: 58,
      industry: 72,
      hazard: 78,
      demographics: 74,
      climate: 70,
      heritage: 42,
    },
  },
  {
    id: "hewan",
    name: "河湾社区",
    subtitle: "滨水住区 · 老龄化 22%",
    coord: { lat: 24.512, lng: 118.105 },
    population: 6.2,
    annualGrowth: 0.004,
    demographics: { elderlyRatio: 0.22, childRatio: 0.1, workingAgeRatio: 0.61, avgIncome: 0.63 },
    price: 3.1,
    priceReason: "滨水景观带来一定价格支撑，但养老医疗与跨区通勤较弱；景观溢价掩盖了日常服务缺口。",
    risks: { geological: 0.1, flood: 0.48, pollution: 0.12, industrial: 0.08, noise: 0.16 },
    metrics: {
      medical: 49,
      education: 61,
      transit: 58,
      care: 37,
      retail: 72,
      green: 90,
      culture: 54,
      dining: 65,
      safety: 72,
      commerce: 48,
      employment: 52,
      tertiaryMedical: 44,
      higherEducation: 39,
      regionalTransit: 51,
      publicService: 55,
      logistics: 46,
      sports: 70,
      digital: 78,
      policy: 68,
      regionalGrowth: 69,
      air: 77,
      ecology: 92,
      industry: 81,
      hazard: 58,
      demographics: 46,
      climate: 66,
      heritage: 61,
    },
  },
  {
    id: "donggang",
    name: "东港里",
    subtitle: "产城混合 · 通勤人口多",
    coord: { lat: 24.49, lng: 118.165 },
    population: 7.4,
    annualGrowth: 0.026,
    demographics: { elderlyRatio: 0.09, childRatio: 0.13, workingAgeRatio: 0.73, avgIncome: 0.71 },
    price: 2.7,
    priceReason: "岗位与规划利好尚未充分资本化；传统工业印象、绿地短缺和风险感知压低成交价，因此模型价值高于市场价格。",
    risks: { geological: 0.06, flood: 0.24, pollution: 0.58, industrial: 0.64, noise: 0.42 },
    metrics: {
      medical: 42,
      education: 46,
      transit: 69,
      care: 32,
      retail: 56,
      green: 38,
      culture: 41,
      dining: 67,
      safety: 57,
      commerce: 62,
      employment: 89,
      tertiaryMedical: 48,
      higherEducation: 55,
      regionalTransit: 76,
      publicService: 58,
      logistics: 92,
      sports: 51,
      digital: 86,
      policy: 78,
      regionalGrowth: 88,
      air: 43,
      ecology: 39,
      industry: 42,
      hazard: 61,
      demographics: 78,
      climate: 65,
      heritage: 31,
    },
  },
  {
    id: "nanhu",
    name: "南湖家园",
    subtitle: "成熟住区 · 儿童占比 18%",
    coord: { lat: 24.501, lng: 118.134 },
    population: 5.8,
    annualGrowth: 0.01,
    demographics: { elderlyRatio: 0.13, childRatio: 0.18, workingAgeRatio: 0.64, avgIncome: 0.74 },
    price: 3.7,
    priceReason: "教育、公园和基层服务共同支撑房价，市场价格与模型价值基本一致，偏差处于可接受范围。",
    risks: { geological: 0.05, flood: 0.08, pollution: 0.06, industrial: 0.05, noise: 0.12 },
    metrics: {
      medical: 75,
      education: 91,
      transit: 72,
      care: 68,
      retail: 81,
      green: 84,
      culture: 78,
      dining: 74,
      safety: 86,
      commerce: 71,
      employment: 59,
      tertiaryMedical: 69,
      higherEducation: 73,
      regionalTransit: 65,
      publicService: 82,
      logistics: 64,
      sports: 81,
      digital: 87,
      policy: 57,
      regionalGrowth: 58,
      air: 79,
      ecology: 85,
      industry: 88,
      hazard: 84,
      demographics: 82,
      climate: 72,
      heritage: 68,
    },
  },
  {
    id: "xicheng",
    name: "西城旧里",
    subtitle: "存量更新 · 建成 28 年",
    coord: { lat: 24.521, lng: 118.083 },
    population: 9.1,
    annualGrowth: -0.003,
    demographics: { elderlyRatio: 0.19, childRatio: 0.1, workingAgeRatio: 0.62, avgIncome: 0.6 },
    price: 3.4,
    priceReason: "商业、餐饮与公交成熟支撑价格，但老旧住房品质和公园托育短板抵消了区位优势，房价与模型值接近。",
    risks: { geological: 0.08, flood: 0.18, pollution: 0.32, industrial: 0.28, noise: 0.45 },
    metrics: {
      medical: 67,
      education: 72,
      transit: 81,
      care: 43,
      retail: 88,
      green: 35,
      culture: 70,
      dining: 91,
      safety: 76,
      commerce: 83,
      employment: 66,
      tertiaryMedical: 88,
      higherEducation: 67,
      regionalTransit: 84,
      publicService: 91,
      logistics: 72,
      sports: 58,
      digital: 82,
      policy: 49,
      regionalGrowth: 51,
      air: 49,
      ecology: 37,
      industry: 67,
      hazard: 69,
      demographics: 56,
      climate: 61,
      heritage: 89,
    },
  },
];

const stadiums: Stadium[] = [
  {
    id: "linhai",
    name: "临海竞赛中心",
    city: "东部赛区 · 候选场馆",
    capacity: 50000,
    metrics: {
      transit: 36,
      lodging: 8,
      egress: 44,
      medical: 31,
      dining: 25,
      sanitary: 29,
      security: 65,
      digital: 76,
      climate: 68,
      commerce: 30,
    },
    limits: { 交通: 18000, 住宿: 4000, 餐饮: 12000, 医疗: 6500, 公卫: 14500 },
  },
  {
    id: "longcheng",
    name: "龙城体育公园",
    city: "中部赛区 · 既有场馆",
    capacity: 62000,
    metrics: {
      transit: 78,
      lodging: 64,
      egress: 71,
      medical: 73,
      dining: 82,
      sanitary: 66,
      security: 79,
      digital: 91,
      climate: 72,
      commerce: 85,
    },
    limits: { 交通: 48000, 住宿: 39600, 餐饮: 50500, 医疗: 45200, 公卫: 41000 },
  },
  {
    id: "huanqiu",
    name: "寰球足球场",
    city: "北部赛区 · 改扩建",
    capacity: 42000,
    metrics: {
      transit: 82,
      lodging: 79,
      egress: 68,
      medical: 77,
      dining: 74,
      sanitary: 61,
      security: 84,
      digital: 88,
      climate: 55,
      commerce: 72,
    },
    limits: { 交通: 38000, 住宿: 33200, 餐饮: 31000, 医疗: 35000, 公卫: 25600 },
  },
];

const matchScenarios: Record<
  MatchScenarioKey,
  {
    label: string;
    attendanceRate: number;
    internationalRatio: number;
    domesticVisitorRatio: number;
    simultaneousLoad: number;
  }
> = {
  group: {
    label: "小组赛 · 双场并发",
    attendanceRate: 0.74,
    internationalRatio: 0.14,
    domesticVisitorRatio: 0.34,
    simultaneousLoad: 1.22,
  },
  knockout: {
    label: "淘汰赛 · 单场高峰",
    attendanceRate: 0.91,
    internationalRatio: 0.28,
    domesticVisitorRatio: 0.4,
    simultaneousLoad: 1,
  },
  final: {
    label: "决赛 · 国际客流峰值",
    attendanceRate: 1,
    internationalRatio: 0.48,
    domesticVisitorRatio: 0.34,
    simultaneousLoad: 1,
  },
};

const stadiumInterventions: StadiumIntervention[] = [
  {
    id: "hotel-cluster",
    appliesTo: ["linhai", "longcheng"],
    type: "住宿集群",
    title: "建设可转换赛事旅馆组团",
    place: "临港站东侧 · 轨道共址地块",
    cost: 2.35,
    constructionYears: 3,
    capacityGain: { 住宿: 9200, 餐饮: 2800 },
    legacyAnnualValue: 0.24,
    reuseRate: 0.88,
    idlenessRisk: 0.18,
  },
  {
    id: "modular-lodging",
    appliesTo: ["linhai", "huanqiu"],
    type: "临时住宿",
    title: "部署模块化住宿与赛后人才公寓",
    place: "场馆北侧综合开发单元",
    cost: 1.08,
    constructionYears: 1,
    capacityGain: { 住宿: 4800, 公卫: 1800 },
    legacyAnnualValue: 0.11,
    reuseRate: 0.81,
    idlenessRisk: 0.24,
  },
  {
    id: "park-ride",
    appliesTo: ["linhai", "longcheng", "huanqiu"],
    type: "交通疏散",
    title: "设置 P+R 接驳与三向离场通道",
    place: "城市外环 · 综合交通廊道",
    cost: 0.86,
    constructionYears: 2,
    capacityGain: { 交通: 16500, 公卫: 1200 },
    legacyAnnualValue: 0.09,
    reuseRate: 0.92,
    idlenessRisk: 0.1,
  },
  {
    id: "medical-hub",
    appliesTo: ["linhai", "huanqiu"],
    type: "医疗急救",
    title: "扩建区域急救与赛事医疗中心",
    place: "场馆东南 · 15 分钟急救圈",
    cost: 1.26,
    constructionYears: 2,
    capacityGain: { 医疗: 7600, 公卫: 2200 },
    legacyAnnualValue: 0.18,
    reuseRate: 0.95,
    idlenessRisk: 0.07,
  },
  {
    id: "fan-zone",
    appliesTo: ["linhai", "longcheng", "huanqiu"],
    type: "餐饮与公卫",
    title: "建设可拆装球迷广场",
    place: "场馆步行圈 · 商业预留地",
    cost: 0.48,
    constructionYears: 1,
    capacityGain: { 餐饮: 9800, 公卫: 7200 },
    legacyAnnualValue: 0.045,
    reuseRate: 0.74,
    idlenessRisk: 0.28,
  },
  {
    id: "egress-upgrade",
    appliesTo: ["longcheng", "huanqiu"],
    type: "场馆改造",
    title: "改造分区闸机与步行疏散系统",
    place: "场馆红线内 · 东西看台",
    cost: 0.72,
    constructionYears: 1,
    capacityGain: { 交通: 4800, 公卫: 3500 },
    legacyAnnualValue: 0.06,
    reuseRate: 0.9,
    idlenessRisk: 0.09,
  },
];

const housingMarkers = [
  { x: 18, y: 22, icon: "医", label: "社区医院", tone: "coral", ring: "inner" },
  { x: 34, y: 58, icon: "学", label: "实验小学", tone: "blue", ring: "inner" },
  { x: 62, y: 31, icon: "园", label: "河湾公园", tone: "lime", ring: "inner" },
  { x: 51, y: 78, icon: "护", label: "托育中心", tone: "coral", ring: "inner" },
  { x: 85, y: 19, icon: "购", label: "生鲜市集", tone: "lime", ring: "inner" },
  { x: 71, y: 64, icon: "商", label: "城市商业中心", tone: "blue", ring: "middle" },
  { x: 27, y: 40, icon: "业", label: "科技园 · 8.6 万岗位", tone: "lime", ring: "middle" },
  { x: 78, y: 42, icon: "轨", label: "综合交通枢纽", tone: "blue", ring: "middle" },
  { x: 45, y: 18, icon: "院", label: "三甲医院", tone: "coral", ring: "middle" },
  { x: 14, y: 74, icon: "校", label: "大学城", tone: "blue", ring: "middle" },
  { x: 91, y: 56, icon: "工", label: "工业缓冲区", tone: "coral", ring: "outer" },
  { x: 57, y: 9, icon: "生", label: "区域生态廊道", tone: "lime", ring: "outer" },
];

const cupMarkers = [
  { x: 44, y: 42, icon: "场", label: "临海竞赛中心", tone: "coral", ring: "middle" },
  { x: 20, y: 71, icon: "站", label: "临港站", tone: "blue", ring: "middle" },
  { x: 74, y: 27, icon: "宿", label: "现有旅馆群", tone: "lime", ring: "middle" },
  { x: 79, y: 72, icon: "医", label: "赛事医院", tone: "coral", ring: "middle" },
];

const BASE_YEAR = 2026;
const DISCOUNT_RATE = 0.04;
const ANNUAL_VALUE_PER_CAPITA = 0.65;

const facilityTypeConfig: Record<
  string,
  {
    label: string;
    capacityReference: number;
    defaultCapacity: number;
    sigma: number;
    decay: DecayType;
    threshold: number;
    scale: number;
    serviceRadius: number;
    constructionYears: number;
    buildCost: number;
    annualOpex: number;
  }
> = {
  medical: { label: "社区卫生服务中心", capacityReference: 2500, defaultCapacity: 3600, sigma: 1.25, decay: "gaussian", threshold: 0.72, scale: 0.28, serviceRadius: 5, constructionYears: 2, buildCost: 0.42, annualOpex: 0.018 },
  education: { label: "九年一贯制学校", capacityReference: 1200, defaultCapacity: 1800, sigma: 1.05, decay: "gaussian", threshold: 0.78, scale: 0.27, serviceRadius: 4, constructionYears: 3, buildCost: 0.92, annualOpex: 0.026 },
  transit: { label: "社区公交接驳枢纽", capacityReference: 4200, defaultCapacity: 7200, sigma: 1.6, decay: "exponential", threshold: 0.7, scale: 0.3, serviceRadius: 6, constructionYears: 2, buildCost: 0.34, annualOpex: 0.022 },
  care: { label: "养老托育复合站", capacityReference: 300, defaultCapacity: 520, sigma: 0.85, decay: "gaussian", threshold: 0.68, scale: 0.26, serviceRadius: 3, constructionYears: 1, buildCost: 0.2, annualOpex: 0.014 },
  retail: { label: "社区邻里中心", capacityReference: 7000, defaultCapacity: 10500, sigma: 0.8, decay: "gravity", threshold: 0.82, scale: 0.3, serviceRadius: 3, constructionYears: 1, buildCost: 0.28, annualOpex: 0.01 },
  green: { label: "社区公园组团", capacityReference: 2.4, defaultCapacity: 4.2, sigma: 1.1, decay: "gaussian", threshold: 0.7, scale: 0.28, serviceRadius: 4, constructionYears: 1, buildCost: 0.13, annualOpex: 0.005 },
  culture: { label: "社区文化中心", capacityReference: 900, defaultCapacity: 1500, sigma: 1.1, decay: "gravity", threshold: 0.76, scale: 0.3, serviceRadius: 4, constructionYears: 2, buildCost: 0.24, annualOpex: 0.009 },
  dining: { label: "社区餐饮集市", capacityReference: 950, defaultCapacity: 1600, sigma: 0.75, decay: "exponential", threshold: 0.72, scale: 0.3, serviceRadius: 2.5, constructionYears: 1, buildCost: 0.12, annualOpex: 0.006 },
  safety: { label: "社区安全服务站", capacityReference: 1, defaultCapacity: 1, sigma: 1.5, decay: "gravity", threshold: 0.62, scale: 0.25, serviceRadius: 5, constructionYears: 1, buildCost: 0.1, annualOpex: 0.008 },
};

const transportModeConfig: Record<
  "bike" | "bus" | "brt" | "metro" | "ferry" | "rail",
  {
    label: string;
    capacityReference: number;
    sigma: number;
    decay: DecayType;
    threshold: number;
    scale: number;
  }
> = {
  bike: { label: "公共自行车", capacityReference: 1500, sigma: 0.75, decay: "gaussian", threshold: 0.62, scale: 0.28 },
  bus: { label: "常规公交", capacityReference: 4200, sigma: 1.15, decay: "exponential", threshold: 0.72, scale: 0.3 },
  brt: { label: "BRT", capacityReference: 6200, sigma: 2.2, decay: "exponential", threshold: 0.7, scale: 0.3 },
  metro: { label: "地铁", capacityReference: 9000, sigma: 3.5, decay: "gravity", threshold: 0.68, scale: 0.3 },
  ferry: { label: "轮渡", capacityReference: 5000, sigma: 5.5, decay: "gravity", threshold: 0.66, scale: 0.3 },
  rail: { label: "城际铁路", capacityReference: 16000, sigma: 18, decay: "gravity", threshold: 0.64, scale: 0.32 },
};

const existingFacilities: Facility[] = [
  { id: "m-01", type: "medical", name: "北园社区医院", lat: 24.536, lng: 118.126, capacity: 3100, quality: 0.88, openingYear: 2018 },
  { id: "m-02", type: "medical", name: "南湖卫生中心", lat: 24.503, lng: 118.136, capacity: 2700, quality: 0.9, openingYear: 2016 },
  { id: "m-03", type: "medical", name: "西城门诊部（演示更新单元）", lat: 24.52, lng: 118.089, capacity: 1800, quality: 0.76, openingYear: 2012, closingYear: 2032, lifecycleSource: "demo" },
  { id: "e-01", type: "education", name: "北园实验学校", lat: 24.532, lng: 118.134, capacity: 1650, quality: 0.9, openingYear: 2020 },
  { id: "e-02", type: "education", name: "南湖小学", lat: 24.499, lng: 118.131, capacity: 1450, quality: 0.94, openingYear: 2015 },
  { id: "e-03", type: "education", name: "河湾学校", lat: 24.516, lng: 118.111, capacity: 980, quality: 0.78, openingYear: 2011 },
  { id: "t-01", type: "transit", name: "北园公交中心", lat: 24.53, lng: 118.128, capacity: 6600, quality: 0.92, openingYear: 2019, transportMode: "bus" },
  { id: "t-02", type: "transit", name: "南湖 BRT 换乘站", lat: 24.505, lng: 118.139, capacity: 5800, quality: 0.87, openingYear: 2017, transportMode: "brt" },
  { id: "t-03", type: "transit", name: "东港地铁支线站", lat: 24.493, lng: 118.16, capacity: 4700, quality: 0.8, openingYear: 2023, transportMode: "metro" },
  { id: "t-04", type: "transit", name: "河湾轨道站（规划）", lat: 24.514, lng: 118.102, capacity: 8200, quality: 0.94, openingYear: 2029, transportMode: "metro" },
  { id: "t-05", type: "transit", name: "西城公交首末站", lat: 24.522, lng: 118.082, capacity: 5200, quality: 0.79, openingYear: 2014, transportMode: "bus" },
  { id: "t-06", type: "transit", name: "南湖骑行换乘点", lat: 24.499, lng: 118.14, capacity: 1800, quality: 0.82, openingYear: 2022, transportMode: "bike" },
  { id: "t-07", type: "transit", name: "东港轮渡接驳", lat: 24.486, lng: 118.172, capacity: 3600, quality: 0.76, openingYear: 2020, transportMode: "ferry" },
  { id: "c-01", type: "care", name: "北园托育中心", lat: 24.538, lng: 118.132, capacity: 280, quality: 0.84, openingYear: 2021 },
  { id: "c-02", type: "care", name: "南湖养老服务站", lat: 24.5, lng: 118.128, capacity: 360, quality: 0.88, openingYear: 2019 },
  { id: "c-03", type: "care", name: "西城日间照料站", lat: 24.519, lng: 118.087, capacity: 190, quality: 0.72, openingYear: 2014 },
  { id: "r-01", type: "retail", name: "北园邻里中心", lat: 24.533, lng: 118.129, capacity: 9300, quality: 0.9, openingYear: 2019 },
  { id: "r-02", type: "retail", name: "河湾生鲜市集", lat: 24.51, lng: 118.109, capacity: 7200, quality: 0.82, openingYear: 2016 },
  { id: "r-03", type: "retail", name: "西城综合市场", lat: 24.522, lng: 118.08, capacity: 10600, quality: 0.8, openingYear: 2008 },
  { id: "r-04", type: "retail", name: "东港便民中心", lat: 24.494, lng: 118.167, capacity: 4300, quality: 0.7, openingYear: 2022 },
  { id: "g-01", type: "green", name: "河湾滨水公园", lat: 24.511, lng: 118.102, capacity: 5.8, quality: 0.96, openingYear: 2018 },
  { id: "g-02", type: "green", name: "南湖中央公园", lat: 24.497, lng: 118.137, capacity: 4.5, quality: 0.92, openingYear: 2013 },
  { id: "g-03", type: "green", name: "北园街心公园", lat: 24.539, lng: 118.125, capacity: 2.1, quality: 0.82, openingYear: 2021 },
  { id: "u-01", type: "culture", name: "南湖文化馆", lat: 24.504, lng: 118.13, capacity: 1350, quality: 0.9, openingYear: 2017 },
  { id: "u-02", type: "culture", name: "西城图书馆", lat: 24.519, lng: 118.079, capacity: 920, quality: 0.84, openingYear: 2010 },
  { id: "d-01", type: "dining", name: "西城餐饮街", lat: 24.52, lng: 118.086, capacity: 2100, quality: 0.86, openingYear: 2012 },
  { id: "d-02", type: "dining", name: "北园生活街", lat: 24.534, lng: 118.136, capacity: 1700, quality: 0.88, openingYear: 2020 },
  { id: "d-03", type: "dining", name: "东港夜市", lat: 24.488, lng: 118.161, capacity: 1250, quality: 0.72, openingYear: 2019 },
  { id: "s-01", type: "safety", name: "北园警务站", lat: 24.531, lng: 118.127, capacity: 1, quality: 0.92, openingYear: 2018 },
  { id: "s-02", type: "safety", name: "南湖消防站", lat: 24.506, lng: 118.14, capacity: 1, quality: 0.95, openingYear: 2015 },
  { id: "s-03", type: "safety", name: "西城警务站", lat: 24.521, lng: 118.085, capacity: 1, quality: 0.82, openingYear: 2011 },
];

const preferenceProfiles: Record<string, Record<string, number>> = {
  elderly: { medical: 1.8, care: 2, green: 1.3, transit: 1.2, retail: 1.1 },
  family: { education: 2, green: 1.5, safety: 1.4, care: 1.3, retail: 1.2 },
  youngWorker: { transit: 1.6, dining: 1.5, digital: 1.4, employment: 1.3, commerce: 1.2 },
};

function annuityFactor(years: number, rate = DISCOUNT_RATE) {
  return (1 - (1 + rate) ** -years) / rate;
}

function haversine(a: Coord, b: Coord) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function decay(distanceKm: number, type: DecayType, sigma: number) {
  if (type === "exponential") return Math.exp(-distanceKm / sigma);
  if (type === "gravity") return 1 / (1 + (distanceKm / sigma) ** 2);
  return Math.exp(-0.5 * (distanceKm / sigma) ** 2);
}

function projectedPopulation(zone: HousingZone, year: number) {
  return zone.population * (1 + zone.annualGrowth) ** Math.max(0, year - BASE_YEAR);
}

function facilityDemandEquivalent(
  zone: HousingZone,
  type: string,
  year: number,
) {
  const populationFactor = projectedPopulation(zone, year) / 6;
  const elderlyFactor = zone.demographics.elderlyRatio / 0.15;
  const childFactor = zone.demographics.childRatio / 0.16;
  if (type === "medical") {
    return populationFactor * (0.72 + 0.28 * elderlyFactor);
  }
  if (type === "education") {
    return populationFactor * Math.max(0.45, childFactor);
  }
  if (type === "care") {
    return populationFactor * Math.max(0.5, elderlyFactor * 0.55 + childFactor * 0.45);
  }
  return populationFactor;
}

function isFacilityActive(facility: Facility, year: number) {
  return (
    facility.openingYear <= year &&
    (facility.closingYear === undefined || facility.closingYear > year)
  );
}

function facilityScore(
  zone: HousingZone,
  zones: HousingZone[],
  facilities: Facility[],
  type: string,
  year: number,
) {
  const config = facilityTypeConfig[type];
  if (!config) return zone.metrics[type] ?? 0;
  const raw = competitiveAccessibility(
    zone.id,
    zones.map((demandZone) => ({
      id: demandZone.id,
      coord: demandZone.coord,
      demand: facilityDemandEquivalent(demandZone, type, year),
    })),
    facilities
      .filter((facility) => facility.type === type && isFacilityActive(facility, year))
      .map((facility) => ({
        coord: facility,
        supply:
          (facility.capacity / config.capacityReference) * facility.quality,
      })),
    (distance) => decay(distance, config.decay, config.sigma),
  );
  return Math.max(
    0,
    Math.min(100, 100 / (1 + Math.exp(-(raw - config.threshold) / config.scale))),
  );
}

function employmentOpportunityScores(
  zone: HousingZone,
  facilities: Facility[],
  year: number,
  routeMatrix?: TravelTimeMatrix,
) {
  const employmentPois = facilities.filter(
    (facility) => facility.type === "employment" && isFacilityActive(facility, year),
  );
  const workingPopulation =
    projectedPopulation(zone, year) *
    10000 *
    Math.max(0.35, zone.demographics.workingAgeRatio);
  return employmentOpportunityIndex({
    zone: { id: zone.id, ...zone.coord },
    facilities: employmentPois,
    workingPopulation,
    routeMatrix,
    fallbackAccessibility: zone.metrics.employment ?? 50,
    fallbackDiversity: zone.metrics.employmentDiversity ?? 45,
  });
}

function transportNodeScore(
  zone: HousingZone,
  zones: HousingZone[],
  facilities: Facility[],
  mode: keyof typeof transportModeConfig,
  year: number,
) {
  const config = transportModeConfig[mode];
  const raw = competitiveAccessibility(
    zone.id,
    zones.map((demandZone) => ({
      id: demandZone.id,
      coord: demandZone.coord,
      demand: facilityDemandEquivalent(demandZone, "transit", year),
    })),
    facilities
      .filter(
        (facility) =>
          facility.type === "transit" &&
          facility.transportMode === mode &&
          isFacilityActive(facility, year),
      )
      .map((facility) => ({
        coord: facility,
        supply:
          (facility.capacity / config.capacityReference) * facility.quality,
      })),
    (distance) => decay(distance, config.decay, config.sigma),
  );
  return Math.max(
    0,
    Math.min(100, 100 / (1 + Math.exp(-(raw - config.threshold) / config.scale))),
  );
}

function adaptiveWeights(
  demographics: Demographics,
  perturbation: Record<string, number> = {},
) {
  const raw = Object.fromEntries(
    housingFactors.map((factor) => {
      const elderly = preferenceProfiles.elderly[factor.key] ?? 1;
      const family = preferenceProfiles.family[factor.key] ?? 1;
      const worker = preferenceProfiles.youngWorker[factor.key] ?? 1;
      const multiplier =
        1 +
        demographics.elderlyRatio * (elderly - 1) +
        demographics.childRatio * (family - 1) +
        demographics.workingAgeRatio * 0.35 * (worker - 1);
      return [factor.key, factor.weight * multiplier * (perturbation[factor.key] ?? 1)];
    }),
  );
  for (const ring of ["inner", "middle", "outer"] as const) {
    const factors = housingFactors.filter((factor) => factor.ring === ring);
    const baseTotal = factors.reduce((sum, factor) => sum + factor.weight, 0);
    const adaptiveTotal = factors.reduce((sum, factor) => sum + raw[factor.key], 0);
    factors.forEach((factor) => {
      raw[factor.key] *= baseTotal / adaptiveTotal;
    });
  }
  return raw;
}

function deriveZoneMetrics(
  zone: HousingZone,
  zones: HousingZone[],
  facilities: Facility[],
  year: number,
  regionalContext: MetricMap = regionalContextMetrics,
  routeMatrix?: TravelTimeMatrix,
) {
  const metrics = { ...zone.metrics };
  housingFactors
    .filter((factor) => factor.ring === "inner" && factor.key !== "transit")
    .forEach((factor) => {
      metrics[factor.key] = facilityScore(zone, zones, facilities, factor.key, year);
    });

  const employment = employmentOpportunityScores(
    zone,
    facilities,
    year,
    routeMatrix,
  );
  metrics.employment = employment.accessibility;
  metrics.employmentDiversity = employment.diversity;

  const busNode = transportNodeScore(zone, zones, facilities, "bus", year);
  const brtNode = transportNodeScore(zone, zones, facilities, "brt", year);
  const metro = transportNodeScore(zone, zones, facilities, "metro", year);
  const bikeInfrastructure = transportNodeScore(zone, zones, facilities, "bike", year);
  const ferryNode = transportNodeScore(zone, zones, facilities, "ferry", year);
  const railNode = transportNodeScore(zone, zones, facilities, "rail", year);
  const bus = busNode * 0.62 + brtNode * 0.38;
  const walking =
    metrics.retail * 0.36 + metrics.green * 0.3 + metrics.safety * 0.34;
  const cycling =
    bikeInfrastructure * 0.56 + metrics.green * 0.26 + metrics.safety * 0.18;
  const road =
    metrics.employment * 0.32 +
    metrics.regionalTransit * 0.28 +
    metrics.logistics * 0.2 +
    metrics.safety * 0.1 +
    (100 - zone.risks.noise * 100) * 0.1;
  const ferryRail = ferryNode * 0.45 + railNode * 0.55;
  const transportBreakdown = {
    walking,
    cycling,
    bus,
    busNode,
    brtNode,
    metro,
    road,
    ferryRail,
    bikeInfrastructure,
    ferryNode,
    railNode,
  };
  metrics.transit =
    walking * 0.2 +
    cycling * 0.12 +
    bus * 0.28 +
    metro * 0.25 +
    road * 0.1 +
    ferryRail * 0.05;
  metrics.regionalTransit =
    zone.metrics.regionalTransit * 0.55 + metro * 0.27 + ferryRail * 0.18;

  Object.entries(regionalContext).forEach(([key, value]) => {
    metrics[key] = value;
  });
  const years = Math.max(0, year - BASE_YEAR);
  metrics.regionalGrowth = Math.max(
    0,
    Math.min(100, metrics.regionalGrowth + years * 0.6),
  );
  return { metrics, transportBreakdown };
}

function weightedScore(metrics: MetricMap, factors: readonly { key: string; weight: number }[]) {
  const total = factors.reduce((sum, factor) => sum + factor.weight, 0);
  return factors.reduce(
    (sum, factor) => sum + (metrics[factor.key] ?? 0) * factor.weight,
    0,
  ) / total;
}

function housingValue(
  zone: HousingZone,
  facilities: Facility[],
  year: number,
  perturbation: Record<string, number> = {},
  regionalContext: MetricMap = regionalContextMetrics,
  zones: HousingZone[] = housingZones,
  routeMatrix?: TravelTimeMatrix,
) {
  const { metrics, transportBreakdown } = deriveZoneMetrics(
    zone,
    zones,
    facilities,
    year,
    regionalContext,
    routeMatrix,
  );
  const weights = adaptiveWeights(zone.demographics, perturbation);
  const ringScores = Object.fromEntries(
    (["inner", "middle", "outer"] as const).map((ring) => {
      const factors = housingFactors.filter((factor) => factor.ring === ring);
      const total = factors.reduce((sum, factor) => sum + weights[factor.key], 0);
      const score = factors.reduce(
        (sum, factor) => sum + metrics[factor.key] * weights[factor.key],
        0,
      ) / total;
      return [ring, score];
    }),
  ) as Record<HousingRing, number>;
  const complementarity =
    3.2 * (metrics.medical / 100) * (metrics.transit / 100) +
    2.4 * (metrics.education / 100) * (metrics.green / 100) +
    1.5 * (metrics.employment / 100) * (metrics.regionalTransit / 100) +
    1.1 * (metrics.employment / 100) * (metrics.employmentDiversity / 100);
  const conflict =
    2.2 * (metrics.care / 100) * (1 - metrics.safety / 100) +
    1.6 * (metrics.green / 100) * zone.risks.pollution;
  const withinCityRaw =
    ringScores.inner * (housingRingMix.inner / 0.9) +
    ringScores.middle * (housingRingMix.middle / 0.9) +
    complementarity -
    conflict;
  const rawScore =
    withinCityRaw * 0.9 + ringScores.outer * housingRingMix.outer;
  const multiplier = weightedRiskMultiplier(zone.risks);
  return {
    score: Math.max(0, Math.min(100, rawScore * multiplier)),
    equityScore: Math.max(
      0,
      Math.min(100, withinCityRaw * multiplier),
    ),
    rawScore,
    withinCityRaw,
    riskMultiplier: multiplier,
    ringScores,
    metrics,
    weights,
    transportBreakdown,
    interactionEffect: complementarity - conflict,
  };
}

function estimateLifecycleCost(parcel: LandParcel, factor: string) {
  const config = facilityTypeConfig[factor];
  const landCost = (parcel.landPrice * parcel.area * 15) / 10000;
  const renewalMultiplier =
    parcel.landUse === "brownfield"
      ? 1.22
      : parcel.landUse === "industrial_renewal"
        ? 1.12
        : 1;
  return (
    landCost +
    config.buildCost * renewalMultiplier +
    config.annualOpex * annuityFactor(20)
  );
}

function generateCandidates(
  parcels: LandParcel[],
  zones: HousingZone[],
  constraints: SiteConstraint[] = [],
): GeneratedCandidate[] {
  if (!zones.length) return [];
  return parcels.flatMap((parcel) =>
    parcel.zoningAllowed.flatMap((factor) => {
      const config = facilityTypeConfig[factor];
      if (!config) return [];
      const nearest = [...zones].sort(
        (a, b) =>
          haversine(a.coord, parcel.center) - haversine(b.coord, parcel.center),
      )[0];
      if (haversine(nearest.coord, parcel.center) > config.serviceRadius) return [];
      const suitability = assessCandidateSuitability(
        parcel.center,
        factor,
        constraints,
      );
      if (!suitability.eligible || suitability.score < 65) return [];
      const baseRobustness =
        100 *
        (0.45 * (1 - parcel.risk) +
          0.3 * parcel.policyCertainty +
          0.25 * (1 - parcel.demolitionDifficulty));
      const robustness = baseRobustness * 0.72 + suitability.score * 0.28;
      return [{
        id: `${parcel.id}-${factor}`,
        parcelId: parcel.id,
        parcelName: parcel.name,
        factor,
        facility: config.label,
        center: parcel.center,
        capacity: config.defaultCapacity,
        quality: 0.9,
        openingYear: BASE_YEAR + config.constructionYears,
        cost: estimateLifecycleCost(parcel, factor),
        robustness,
        suitabilityScore: suitability.score,
        constraintVerified: suitability.verified,
        constraintNotes: suitability.notes,
        nearestZoneId: nearest.id,
      }];
    }),
  );
}

function candidateToFacility(candidate: GeneratedCandidate): Facility {
  return {
    id: candidate.id,
    type: candidate.factor,
    name: candidate.facility,
    lat: candidate.center.lat,
    lng: candidate.center.lng,
    capacity: candidate.capacity,
    quality: candidate.quality,
    openingYear: candidate.openingYear,
    lifecycleSource: "optimizer",
    transportMode: candidate.factor === "transit" ? "bus" : undefined,
  };
}

function cvar90(candidate: GeneratedCandidate) {
  const exposure = 1 - candidate.robustness / 100;
  const losses = [0.45, 0.7, 0.95, 1.25, 1.6]
    .map((shock) => candidate.cost * exposure * shock)
    .sort((a, b) => b - a);
  return (losses[0] + losses[1]) / 2;
}

function evaluatePortfolio(
  selected: GeneratedCandidate[],
  year: number,
  equityShare: number,
  perturbation: Record<string, number> = {},
  zones: HousingZone[] = housingZones,
  baseFacilities: Facility[] = existingFacilities,
  regionalContext: MetricMap = regionalContextMetrics,
  routeMatrix?: TravelTimeMatrix,
): PortfolioEvaluation {
  const nextFacilities = [
    ...baseFacilities,
    ...selected.map(candidateToFacility),
  ];
  const baseModels = zones.map((zone) =>
    housingValue(zone, baseFacilities, year, perturbation, regionalContext, zones, routeMatrix),
  );
  const nextModels = zones.map((zone) =>
    housingValue(zone, nextFacilities, year, perturbation, regionalContext, zones, routeMatrix),
  );
  const populationWeights = zones.map((zone) =>
    projectedPopulation(zone, year),
  );
  const baseFairness = fairnessIndex(
    baseModels.map((model) => model.equityScore),
    populationWeights,
  );
  const nextFairness = fairnessIndex(
    nextModels.map((model) => model.equityScore),
    populationWeights,
  );
  const benefitYears = Math.max(8, 20 - Math.max(0, year - BASE_YEAR));
  const benefitPv = annuityFactor(benefitYears);
  const efficiencyAnnual = zones.reduce((sum, zone, index) => {
    const delta = (nextModels[index].score - baseModels[index].score) / 100;
    return (
      sum +
      projectedPopulation(zone, year) * ANNUAL_VALUE_PER_CAPITA * delta
    );
  }, 0);
  const diminishingWelfareAnnual = zones.reduce((sum, zone, index) => {
    const before = Math.max(0.01, baseModels[index].equityScore / 100);
    const after = Math.max(0.01, nextModels[index].equityScore / 100);
    const welfareDelta = 2 * Math.sqrt(after) - 2 * Math.sqrt(before);
    return (
      sum +
      projectedPopulation(zone, year) *
        ANNUAL_VALUE_PER_CAPITA *
        welfareDelta
    );
  }, 0);
  const totalPopulation = populationWeights.reduce((sum, value) => sum + value, 0);
  const fairnessAnnual =
    totalPopulation *
    ANNUAL_VALUE_PER_CAPITA *
    Math.max(-0.2, (nextFairness - baseFairness) / 100);
  const minimumStandardAnnual = zones.reduce((sum, zone, index) => {
    const before = baseModels[index].equityScore / 100;
    const after = nextModels[index].equityScore / 100;
    const closedGap = Math.max(0, 0.45 - before) - Math.max(0, 0.45 - after);
    return (
      sum +
      projectedPopulation(zone, year) *
        ANNUAL_VALUE_PER_CAPITA *
        closedGap
    );
  }, 0);
  const equityAnnual =
    diminishingWelfareAnnual + fairnessAnnual * 0.65 + minimumStandardAnnual * 1.1;
  const lifecycleCost = selected.reduce(
    (sum, candidate) => sum + candidate.cost,
    0,
  );
  const robustnessPenalty = selected.reduce(
    (sum, candidate) => sum + cvar90(candidate),
    0,
  );
  const efficiencyBenefit = efficiencyAnnual * benefitPv;
  const equityBenefit = equityAnnual * benefitPv;
  const objective =
    (1 - equityShare) * efficiencyBenefit +
    equityShare * equityBenefit -
      lifecycleCost -
      robustnessPenalty;
  const scores = nextModels.map((model) => model.score);
  const equityScores = nextModels.map((model) => model.equityScore);
  return {
    scores,
    equityScores,
    efficiencyBenefit,
    equityBenefit,
    lifecycleCost,
    robustnessPenalty,
    objective,
    fairness: nextFairness,
  };
}

function optimizePortfolio(
  candidates: GeneratedCandidate[],
  budget: number,
  equityShare: number,
  year: number,
  perturbation: Record<string, number> = {},
  zones: HousingZone[] = housingZones,
  baseFacilities: Facility[] = existingFacilities,
  regionalContext: MetricMap = regionalContextMetrics,
  routeMatrix?: TravelTimeMatrix,
) {
  let selected: GeneratedCandidate[] = [];
  let current = evaluatePortfolio(
    selected,
    year,
    equityShare,
    perturbation,
    zones,
    baseFacilities,
    regionalContext,
    routeMatrix,
  );
  while (selected.length < 4) {
    const available = candidates
      .filter(
        (candidate) =>
          !selected.some((item) => item.id === candidate.id) &&
          !selected.some((item) => item.parcelId === candidate.parcelId) &&
          current.lifecycleCost + candidate.cost <= budget,
      )
      .map((candidate) => {
        const evaluation = evaluatePortfolio(
          [...selected, candidate],
          year,
          equityShare,
          perturbation,
          zones,
          baseFacilities,
          regionalContext,
          routeMatrix,
        );
        return {
          candidate,
          evaluation,
          marginal: evaluation.objective - current.objective,
        };
      })
      .sort((a, b) => b.marginal - a.marginal);
    if (!available[0] || available[0].marginal <= 0) break;
    selected = [...selected, available[0].candidate];
    current = available[0].evaluation;
  }

  for (let pass = 0; pass < 3; pass += 1) {
    let bestSwap:
      | { portfolio: GeneratedCandidate[]; evaluation: PortfolioEvaluation }
      | undefined;
    selected.forEach((chosen, index) => {
      candidates.forEach((candidate) => {
        if (selected.some((item) => item.id === candidate.id)) return;
        const trial = selected.map((item, itemIndex) =>
          itemIndex === index ? candidate : item,
        );
        if (new Set(trial.map((item) => item.parcelId)).size !== trial.length) return;
        if (trial.reduce((sum, item) => sum + item.cost, 0) > budget) return;
        const evaluation = evaluatePortfolio(
          trial,
          year,
          equityShare,
          perturbation,
          zones,
          baseFacilities,
          regionalContext,
          routeMatrix,
        );
        if (
          evaluation.objective > current.objective + 0.001 &&
          (!bestSwap || evaluation.objective > bestSwap.evaluation.objective)
        ) {
          bestSwap = { portfolio: trial, evaluation };
        }
      });
    });
    if (!bestSwap) break;
    selected = bestSwap.portfolio;
    current = bestSwap.evaluation;
  }
  return { selected, evaluation: current };
}

function worldCupDemand(stadium: Stadium, scenarioKey: MatchScenarioKey) {
  const scenario = matchScenarios[scenarioKey];
  const spectators = stadium.capacity * scenario.attendanceRate;
  const lodgingShare =
    scenario.internationalRatio + scenario.domesticVisitorRatio * 0.65;
  return {
    spectators,
    required: {
      交通: spectators * 0.92 * scenario.simultaneousLoad,
      住宿: spectators * lodgingShare * scenario.simultaneousLoad,
      餐饮: spectators * 0.74 * scenario.simultaneousLoad,
      医疗: spectators * 0.13 * scenario.simultaneousLoad,
      公卫: spectators * 0.55 * scenario.simultaneousLoad,
    },
  };
}

function evaluateWorldCupPortfolio(
  stadium: Stadium,
  scenarioKey: MatchScenarioKey,
  selected: StadiumIntervention[],
  legacyShare: number,
) {
  const demand = worldCupDemand(stadium, scenarioKey);
  const supply = { ...stadium.limits };
  selected.forEach((intervention) => {
    (Object.keys(intervention.capacityGain) as Array<keyof Stadium["limits"]>).forEach(
      (key) => {
        supply[key] += intervention.capacityGain[key] ?? 0;
      },
    );
  });
  const readinessByChain = Object.fromEntries(
    (Object.keys(demand.required) as Array<keyof Stadium["limits"]>).map((key) => [
      key,
      Math.min(1, supply[key] / demand.required[key]),
    ]),
  ) as Record<keyof Stadium["limits"], number>;
  const limitingEntry = (
    Object.entries(readinessByChain) as Array<
      [keyof Stadium["limits"], number]
    >
  ).sort((a, b) => a[1] - b[1])[0];
  const effectiveAttendance = demand.spectators * limitingEntry[1];
  const eventBenefit =
    Math.max(0, effectiveAttendance) * 8 * 0.000036;
  const legacyValue = selected.reduce(
    (sum, intervention) =>
      sum +
      intervention.legacyAnnualValue *
        intervention.reuseRate *
        annuityFactor(15),
    0,
  );
  const lifecycleCost = selected.reduce(
    (sum, intervention) => sum + intervention.cost,
    0,
  );
  const idlenessPenalty = selected.reduce(
    (sum, intervention) =>
      sum +
      intervention.cost *
        intervention.idlenessRisk *
        (1 - intervention.reuseRate) *
        1.5,
    0,
  );
  return {
    demand,
    supply,
    readinessByChain,
    bottleneck: limitingEntry[0],
    effectiveAttendance,
    eventBenefit,
    legacyValue,
    lifecycleCost,
    idlenessPenalty,
    objective:
      (1 - legacyShare) * eventBenefit +
      legacyShare * legacyValue -
      lifecycleCost -
      idlenessPenalty,
  };
}

function optimizeWorldCupPortfolio(
  stadium: Stadium,
  scenarioKey: MatchScenarioKey,
  budget: number,
  legacyShare: number,
) {
  const candidates = stadiumInterventions.filter((intervention) =>
    intervention.appliesTo.includes(stadium.id) ||
    Boolean(stadium.dataSource && stadium.dataSource !== "demo"),
  );
  let selected: StadiumIntervention[] = [];
  let current = evaluateWorldCupPortfolio(
    stadium,
    scenarioKey,
    selected,
    legacyShare,
  );
  while (selected.length < 3) {
    const options = candidates
      .filter(
        (candidate) =>
          !selected.some((item) => item.id === candidate.id) &&
          current.lifecycleCost + candidate.cost <= budget,
      )
      .map((candidate) => {
        const evaluation = evaluateWorldCupPortfolio(
          stadium,
          scenarioKey,
          [...selected, candidate],
          legacyShare,
        );
        return {
          candidate,
          evaluation,
          marginal: evaluation.objective - current.objective,
        };
      })
      .sort((a, b) => b.marginal - a.marginal);
    if (!options[0] || options[0].marginal <= 0) break;
    selected = [...selected, options[0].candidate];
    current = options[0].evaluation;
  }
  return { selected, evaluation: current, candidateCount: candidates.length };
}

function stdDev(values: number[]) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function fairnessIndex(values: number[], weights = values.map(() => 1)) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const weightedMean =
    values.reduce(
      (sum, value, index) => sum + value * weights[index],
      0,
    ) / totalWeight;
  if (!Number.isFinite(weightedMean) || weightedMean <= 0) return 0;
  let pairDifference = 0;
  values.forEach((valueA, indexA) => {
    values.forEach((valueB, indexB) => {
      pairDifference +=
        weights[indexA] * weights[indexB] * Math.abs(valueA - valueB);
    });
  });
  const weightedGini =
    pairDifference / (2 * totalWeight ** 2 * weightedMean);
  return Math.max(0, Math.min(100, (1 - weightedGini) * 100));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(Math.round(value));
}

function deterministicNoise(sample: number, key: string) {
  const keySeed = [...key].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );
  const value = Math.sin(sample * 9283.17 + keySeed * 17.31) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

const emptyScenario: AnalysisScenario = {
  region: "",
  center: { lat: 35.8617, lng: 104.1954 },
  zones: [],
  facilities: [],
  constraints: [],
  parcels: [],
  regionalContext: Object.fromEntries(
    Object.keys(regionalContextMetrics).map((key) => [key, 0]),
  ),
  hasMarketPrices: false,
  isImported: false,
  employmentPoiCount: 0,
  estimatedJobs: null,
  employmentDataStatus: "none",
  parcelDataStatus: "none",
  dataNote: "尚未选择分析区域。导入地图数据或手动建立居住区后才会运行模型。",
};

const emptyMetricMap = Object.fromEntries(
  housingFactors.map((factor) => [factor.key, 0]),
) as MetricMap;

const emptyHousingView = {
  id: "",
  name: "尚未选择区域",
  subtitle: "等待导入或手动构建",
  coord: emptyScenario.center,
  population: 0,
  annualGrowth: 0,
  demographics: {
    elderlyRatio: 0,
    childRatio: 0,
    workingAgeRatio: 0,
    avgIncome: 0,
  },
  price: 0,
  priceReason: "尚未导入房价数据。",
  risks: { geological: 0, flood: 0, pollution: 0, industrial: 0, noise: 0 },
  service: 0,
  score: 0,
  equityScore: 0,
  rawScore: 0,
  riskMultiplier: 1,
  metrics: emptyMetricMap,
  weights: Object.fromEntries(housingFactors.map((factor) => [factor.key, factor.weight])),
  transportBreakdown: {
    walking: 0,
    cycling: 0,
    bus: 0,
    busNode: 0,
    brtNode: 0,
    metro: 0,
    road: 0,
    ferryRail: 0,
    bikeInfrastructure: 0,
    ferryNode: 0,
    railNode: 0,
  },
  interactionEffect: 0,
  ringScores: { inner: 0, middle: 0, outer: 0 },
  valueIndex: 0,
  priceIndex: 0,
  residual: 0,
};

function selectDistributedPois(points: TencentPoi[], count: number) {
  if (points.length <= count) return points;
  const centroid = {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  };
  const selected = [
    [...points].sort((a, b) => haversine(b, centroid) - haversine(a, centroid))[0],
  ];
  while (selected.length < count) {
    const next = points
      .filter((point) => !selected.includes(point))
      .map((point) => ({
        point,
        nearest: Math.min(...selected.map((chosen) => haversine(point, chosen))),
      }))
      .sort((a, b) => b.nearest - a.nearest)[0]?.point;
    if (!next) break;
    selected.push(next);
  }
  return selected;
}

function poiFacilityMapping(category = "") {
  if (/写字楼|产业园|公司企业|商务中心/.test(category)) {
    return { type: "employment", transportMode: undefined };
  }
  if (/医院/.test(category)) return { type: "medical", transportMode: undefined };
  if (/学校|幼儿园/.test(category)) return { type: "education", transportMode: undefined };
  if (/BRT/i.test(category)) return { type: "transit", transportMode: "brt" as const };
  if (/地铁/.test(category)) return { type: "transit", transportMode: "metro" as const };
  if (/公交/.test(category)) return { type: "transit", transportMode: "bus" as const };
  if (/自行车/.test(category)) return { type: "transit", transportMode: "bike" as const };
  if (/轮渡/.test(category)) return { type: "transit", transportMode: "ferry" as const };
  if (/火车|铁路/.test(category)) return { type: "transit", transportMode: "rail" as const };
  if (/养老|托育/.test(category)) return { type: "care", transportMode: undefined };
  if (/菜市场|商场/.test(category)) return { type: "retail", transportMode: undefined };
  if (/公园/.test(category)) return { type: "green", transportMode: undefined };
  if (/图书馆/.test(category)) return { type: "culture", transportMode: undefined };
  if (/餐厅/.test(category)) return { type: "dining", transportMode: undefined };
  if (/派出所/.test(category)) return { type: "safety", transportMode: undefined };
  return undefined;
}

function estimatedEmploymentCapacity(category = "") {
  if (/产业园/.test(category)) return 2500;
  if (/写字楼/.test(category)) return 800;
  if (/商务中心/.test(category)) return 500;
  return 80;
}

function constraintKindFromPoi(point: TencentPoi): ConstraintKind | undefined {
  const query = point.category ?? "";
  const evidence = `${point.name ?? ""}|${point.poiCategory ?? ""}`;
  if (/机场/.test(query) && /机场|航空/.test(evidence)) return "airport";
  if (/港口/.test(query) && /港口|港区|码头|集装箱|货运/.test(evidence)) return "port";
  if (/化工园/.test(query) && /化工|石化|危化/.test(evidence)) return "industrial";
  if (/垃圾处理/.test(query) && /垃圾|废弃物|焚烧/.test(evidence)) return "waste";
  if (/污水处理/.test(query) && /污水|水质净化/.test(evidence)) return "wastewater";
  if (/铁路货运站/.test(query) && /货运|编组站|铁路物流/.test(evidence)) return "freight";
  return undefined;
}

function buildProxyParcels(zones: HousingZone[]): LandParcel[] {
  const allowedSets = [
    ["medical", "care", "green"],
    ["education", "transit", "culture"],
    ["retail", "dining", "safety"],
  ];
  return zones.flatMap((zone, zoneIndex) =>
    [0, 1].map((offsetIndex) => ({
      id: `proxy-${zone.id}-${offsetIndex + 1}`,
      name: `${zone.name}候选网格 ${offsetIndex + 1}（待用地核验）`,
      center: {
        lat: zone.coord.lat + (offsetIndex === 0 ? 0.0045 : -0.0038),
        lng: zone.coord.lng + (offsetIndex === 0 ? -0.0042 : 0.0048),
      },
      area: 1.2,
      landPrice: 280,
      landUse: "vacant" as const,
      zoningAllowed: allowedSets[(zoneIndex + offsetIndex) % allowedSets.length],
      demolitionDifficulty: 0.25,
      policyCertainty: 0.42,
      risk: 0.22,
    })),
  );
}

function buildImportedScenario(region: string, points: TencentPoi[]): AnalysisScenario {
  const residential = points.filter((point) => /住宅小区/.test(point.category ?? ""));
  const zoneSources = selectDistributedPois(
    residential.length >= 2 ? residential : points,
    Math.min(6, Math.max(2, residential.length || points.length)),
  );
  const middleDefaults = Object.fromEntries(
    housingFactors.map((factor) => {
      return [factor.key, factor.ring === "inner" ? 0 : 50];
    }),
  );
  const zones: HousingZone[] = zoneSources.map((point, index) => ({
    id: `import-zone-${point.id ?? index}`,
    name: point.name ?? `社区样本 ${index + 1}`,
    subtitle: "腾讯住宅 POI · 人口/风险为待校准代理值",
    coord: { lat: point.lat, lng: point.lng },
    population: 6,
    annualGrowth: 0.008,
    demographics: {
      elderlyRatio: 0.15,
      childRatio: 0.16,
      workingAgeRatio: 0.66,
      avgIncome: 0.7,
    },
    price: 0,
    priceReason: "尚未导入同口径房价数据，因此本区域不执行房价残差校验。",
    risks: {
      geological: 0.08,
      flood: 0.12,
      pollution: 0.1,
      industrial: 0.1,
      noise: 0.16,
    },
    metrics: { ...middleDefaults },
  }));
  const constraints: SiteConstraint[] = points.flatMap((point, index) => {
    const kind = constraintKindFromPoi(point);
    if (!kind) return [];
    return [{
      id: `constraint-${point.id ?? index}`,
      name: point.name ?? constraintLabels[kind],
      kind,
      lat: point.lat,
      lng: point.lng,
    }];
  });
  const facilities: Facility[] = points.flatMap((point, index) => {
    if (/住宅小区/.test(point.category ?? "")) return [];
    if (constraintKindFromPoi(point)) return [];
    const mapping = poiFacilityMapping(point.category);
    if (!mapping) return [];
    const config = facilityTypeConfig[mapping.type];
    if (!config && mapping.type !== "employment") return [];
    return [{
      id: `import-facility-${point.id ?? index}`,
      type: mapping.type,
      name: point.name ?? point.category ?? "腾讯地图设施",
      lat: point.lat,
      lng: point.lng,
      capacity:
        mapping.type === "employment"
          ? estimatedEmploymentCapacity(point.category)
          : config!.defaultCapacity,
      quality: mapping.type === "employment" ? 0.72 : 0.78,
      openingYear: BASE_YEAR,
      lifecycleSource: "tencent_poi" as const,
      mapSource: point.source ?? "tencent",
      transportMode: mapping.transportMode,
      industryCategory: undefined,
      employmentSource:
        mapping.type === "employment" ? "poi_proxy" as const : undefined,
    }];
  });
  const employmentFacilities = facilities.filter(
    (facility) => facility.type === "employment",
  );
  const estimatedJobs = employmentFacilities.reduce(
    (sum, facility) => sum + facility.capacity,
    0,
  );
  const centerSource = zones.length ? zones.map((zone) => zone.coord) : points;
  const center = {
    lat: centerSource.reduce((sum, point) => sum + point.lat, 0) / centerSource.length,
    lng: centerSource.reduce((sum, point) => sum + point.lng, 0) / centerSource.length,
  };
  const regionalContext = Object.fromEntries(
    Object.keys(regionalContextMetrics).map((key) => [key, 60]),
  );
  return {
    region,
    center,
    zones,
    facilities,
    constraints,
    parcels: buildProxyParcels(zones),
    regionalContext,
    hasMarketPrices: false,
    isImported: true,
    employmentPoiCount: employmentFacilities.length,
    estimatedJobs,
    employmentDataStatus: "poi_proxy",
    parcelDataStatus: "proxy",
    dataNote: `已用腾讯位置服务与天地图融合数据建立 ${zones.length} 个社区样本、${facilities.length} 个服务/岗位 POI，并检索 ${constraints.length} 个机场、港口等冲突源。岗位数和候选用地仍是代理值，必须用统计/规划数据校准。`,
  };
}

async function requestRouteMatrix(
  zones: HousingZone[],
  facilities: Facility[],
  profile: RouteMatrixProfile = "driving",
): Promise<TravelTimeMatrix> {
  if (!zones.length || !facilities.length) {
    throw new Error("需要至少一个社区和一个设施才能建立路网矩阵。");
  }
  const durationsMinutes: Record<string, number> = {};
  const distancesKm: Record<string, number> = {};
  let matrixSource: TravelTimeMatrix["source"] = "osrm_public_demo";
  let generatedAt = new Date().toISOString();
  const employmentFacilities = facilities.filter((facility) => facility.type === "employment");
  const routePool = employmentFacilities.length ? employmentFacilities : facilities;
  const routeFacilityIndex = new Map<string, Facility>();
  zones.forEach((zone) => {
    [...routePool]
      .sort((left, right) => haversine(zone.coord, left) - haversine(zone.coord, right))
      .slice(0, 10)
      .forEach((facility) => routeFacilityIndex.set(facility.id, facility));
  });
  const routeFacilities = [...routeFacilityIndex.values()].slice(0, 60);
  const chunkSize = 60;
  for (let offset = 0; offset < routeFacilities.length; offset += chunkSize) {
    const destinations = routeFacilities.slice(offset, offset + chunkSize);
    const response = await fetch("/api/routing/matrix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile,
        sources: zones.map((zone) => ({
          id: zone.id,
          ...zone.coord,
          coordinateSystem: "gcj02",
        })),
        destinations: destinations.map((facility) => ({
          id: facility.id,
          lat: facility.lat,
          lng: facility.lng,
          coordinateSystem: "gcj02",
        })),
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      source?: TravelTimeMatrix["source"];
      generatedAt?: string;
      sources?: string[];
      destinations?: string[];
      durationsMinutes?: Array<Array<number | null>>;
      distancesKm?: Array<Array<number | null>>;
    };
    if (!response.ok || !payload.sources || !payload.destinations || !payload.durationsMinutes) {
      throw new Error(payload.error || "路网服务没有返回有效矩阵。");
    }
    matrixSource = payload.source ?? matrixSource;
    generatedAt = payload.generatedAt ?? generatedAt;
    payload.sources.forEach((sourceId, sourceIndex) => {
      payload.destinations!.forEach((destinationId, destinationIndex) => {
        const duration = payload.durationsMinutes?.[sourceIndex]?.[destinationIndex];
        const distance = payload.distancesKm?.[sourceIndex]?.[destinationIndex];
        if (typeof duration === "number") {
          durationsMinutes[matrixKey(sourceId, destinationId)] = duration;
        }
        if (typeof distance === "number") {
          distancesKm[matrixKey(sourceId, destinationId)] = distance;
        }
      });
    });
  }
  return {
    source: matrixSource,
    profile,
    durationsMinutes,
    distancesKm,
    generatedAt,
    destinationCount: routeFacilities.length,
    note:
      matrixSource === "openrouteservice"
        ? `坐标转换后按需调用 OpenRouteService ${profile === "walking" ? "步行" : "骑行"}矩阵；覆盖 ${routeFacilities.length}/${routePool.length} 个近邻岗位点，其余点保留直线距离回退。相同坐标与方式在服务实例内缓存 24 小时，减少额度消耗。`
        : matrixSource === "osrm_public_demo"
        ? `腾讯/高德坐标先转换为 WGS-84，再调用 OSRM 公共演示服务生成行车时间矩阵；覆盖每个社区最近的岗位点（去重后 ${routeFacilities.length}/${routePool.length}），其余点保留直线距离回退。正式应用应切换自建实例或持牌服务。`
        : `坐标转换后调用自定义 OSRM 实例；覆盖 ${routeFacilities.length}/${routePool.length} 个近邻岗位点，其余点保留直线距离回退。`,
  };
}

function manualHousingMapping(label: string) {
  if (label === "社区卫生服务中心") return { type: "medical", transportMode: undefined };
  if (label === "小学") return { type: "education", transportMode: undefined };
  if (label === "托育中心") return { type: "care", transportMode: undefined };
  if (label === "公交枢纽") return { type: "transit", transportMode: "bus" as const };
  if (label === "社区公园") return { type: "green", transportMode: undefined };
  return undefined;
}

function manualWorldCupChain(label: string): WorldCupChain | undefined {
  if (label === "赛事旅馆") return "住宿";
  if (label === "P+R 接驳站") return "交通";
  if (label === "球迷广场") return "餐饮";
  if (label === "急救站") return "医疗";
  if (label === "公共卫生间") return "公卫";
  return undefined;
}

function importedWorldCupChain(category = ""): WorldCupChain | undefined {
  return worldCupChainForPoi(category);
}

function importedWorldCupCapacity(category = "") {
  return worldCupNominalCapacity(category);
}

function worldCupPoiText(point: TencentPoi) {
  return `${point.category ?? ""}|${point.poiCategory ?? ""}|${point.name ?? ""}`;
}

function isWorldCupStadiumPoi(point: TencentPoi) {
  return isWorldCupStadiumDescription(worldCupPoiText(point));
}

async function requestWorldCupRouteTimes(
  stadiumPoints: Array<{ id: string; coord: Coord }>,
  points: TencentPoi[],
) {
  const destinations = points
    .filter((point) => importedWorldCupChain(worldCupPoiText(point)))
    .slice(0, 60);
  if (!stadiumPoints.length || !destinations.length) return new Map<string, number>();
  const response = await fetch("/api/routing/matrix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profile: "driving",
      sources: stadiumPoints.map((stadium) => ({
        id: stadium.id,
        ...stadium.coord,
        coordinateSystem: "gcj02",
      })),
      destinations: destinations.map((point, index) => ({
        id: point.id ?? `worldcup-destination-${index}`,
        lat: point.lat,
        lng: point.lng,
        coordinateSystem: "gcj02",
      })),
    }),
  });
  const payload = (await response.json()) as {
    sources?: string[];
    destinations?: string[];
    durationsMinutes?: Array<Array<number | null>>;
  };
  if (!response.ok || !payload.sources || !payload.destinations || !payload.durationsMinutes) {
    return new Map<string, number>();
  }
  const routeTimes = new Map<string, number>();
  payload.sources.forEach((stadiumId, sourceIndex) => {
    payload.destinations!.forEach((destinationId, destinationIndex) => {
      const minutes = payload.durationsMinutes?.[sourceIndex]?.[destinationIndex];
      if (typeof minutes === "number") {
        routeTimes.set(`${stadiumId}::${destinationId}`, minutes);
      }
    });
  });
  return routeTimes;
}

function buildImportedWorldCupFacilities(
  points: TencentPoi[],
  stadiumId: string,
  stadiumCoord: Coord,
  routeTimes: Map<string, number> = new Map(),
): ManualWorldCupFacility[] {
  return points.flatMap((point, index) => {
    if (isWorldCupStadiumPoi(point)) return [];
    const description = worldCupPoiText(point);
    const chain = importedWorldCupChain(description);
    const nominalCapacity = importedWorldCupCapacity(description);
    if (!chain || nominalCapacity <= 0) return [];
    const distanceKm = haversine(stadiumCoord, point);
    if (distanceKm > worldCupChainRadiusKm[chain] * 1.5) return [];
    const pointId = point.id ?? `worldcup-destination-${index}`;
    const routeMinutes = routeTimes.get(`${stadiumId}::${pointId}`);
    const accessibility = worldCupAccessibility(chain, distanceKm, routeMinutes);
    const sourceConfidence = point.source === "cross_verified"
      ? 1
      : point.source === "tianditu"
        ? 0.9
        : 0.95;
    const capacity = Math.round(nominalCapacity * accessibility * sourceConfidence);
    if (capacity <= 0) return [];
    return [{
      id: `worldcup-poi-${stadiumId}-${pointId}`,
      stadiumId,
      name: point.name ?? point.category ?? `赛事设施 ${index + 1}`,
      chain,
      capacity,
      coord: { lat: point.lat, lng: point.lng },
      source: point.source ?? "tencent",
      routeMinutes,
      distanceKm,
    }];
  });
}

function buildImportedWorldCupStadiums(
  region: string,
  points: TencentPoi[],
  routeTimes: Map<string, number>,
) {
  const stadiumPoints = selectDistributedPois(
    points.filter(isWorldCupStadiumPoi),
    6,
  );
  const stadiumRows = stadiumPoints.map((point, index) => {
    const id = `map-stadium-${point.id ?? index}`;
    const coord = { lat: point.lat, lng: point.lng };
    const facilities = buildImportedWorldCupFacilities(points, id, coord, routeTimes);
    const limits: Stadium["limits"] = { 交通: 0, 住宿: 0, 餐饮: 0, 医疗: 0, 公卫: 0 };
    facilities.forEach((facility) => {
      limits[facility.chain] += facility.capacity;
    });
    const capacity = 40_000;
    const stadium: Stadium = {
      id,
      name: point.name ?? `候选场馆 ${index + 1}`,
      city: `${region} · 地图识别场馆`,
      capacity,
      coord,
      dataSource: "map_import",
      mapSource: point.source ?? "tencent",
      metrics: {
        transit: Math.min(100, limits.交通 / capacity * 100),
        lodging: Math.min(100, limits.住宿 / capacity * 100),
        egress: Math.min(100, limits.交通 / capacity * 85),
        medical: Math.min(100, limits.医疗 / (capacity * 0.13) * 100),
        dining: Math.min(100, limits.餐饮 / (capacity * 0.74) * 100),
        sanitary: Math.min(100, limits.公卫 / (capacity * 0.55) * 100),
        security: 50,
        digital: 50,
        climate: 50,
        commerce: Math.min(100, limits.餐饮 / (capacity * 0.5) * 100),
      },
      limits: { 交通: 0, 住宿: 0, 餐饮: 0, 医疗: 0, 公卫: 0 },
    };
    return { stadium, facilities };
  });
  return {
    stadiums: stadiumRows.map((row) => row.stadium),
    facilities: stadiumRows.flatMap((row) => row.facilities),
  };
}

function offsetCoord(center: Coord, northKm: number, eastKm: number): Coord {
  const latitudeOffset = northKm / 111;
  const longitudeOffset = eastKm / (111 * Math.max(0.2, Math.cos(center.lat * Math.PI / 180)));
  return { lat: center.lat + latitudeOffset, lng: center.lng + longitudeOffset };
}

const worldCupInterventionOffsets: Record<string, [number, number, number]> = {
  "hotel-cluster": [2.4, 2.1, 3.5],
  "modular-lodging": [1.6, -1.2, 2.2],
  "park-ride": [-3.8, -3.1, 6],
  "medical-hub": [-2.2, 2.4, 4],
  "fan-zone": [0.4, -1.8, 1.5],
  "egress-upgrade": [0.3, 0.3, 0.8],
};

function worldCupInterventionPlace(
  intervention: StadiumIntervention,
  stadium: Stadium,
) {
  if (stadium.dataSource !== "map_import") return intervention.place;
  const [northKm, eastKm] = worldCupInterventionOffsets[intervention.id] ?? [1, 1];
  const northSouth = northKm >= 0 ? "北" : "南";
  const eastWest = eastKm >= 0 ? "东" : "西";
  const distanceKm = Math.hypot(northKm, eastKm);
  return `${stadium.name}${northSouth}${eastWest}方向约 ${distanceKm.toFixed(1)}km · 待法定控规地块核验`;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("housing");
  const [mapScale, setMapScale] = useState<MapScale>("local");
  const [mapView, setMapView] = useState<MapView>("real");
  const [routeProfile, setRouteProfile] = useState<RouteMatrixProfile>("driving");
  const [activeHousingId, setActiveHousingId] = useState("");
  const [activeRecommendationId, setActiveRecommendationId] = useState("");
  const [activeCupInterventionId, setActiveCupInterventionId] = useState("");
  const [activeStadiumId, setActiveStadiumId] = useState("linhai");
  const [fairnessWeight, setFairnessWeight] = useState(68);
  const [budget, setBudget] = useState(3.2);
  const [forecastYear, setForecastYear] = useState(2030);
  const [matchScenario, setMatchScenario] =
    useState<MatchScenarioKey>("final");
  const [factorView, setFactorView] = useState<"core" | "all">("all");
  const [panel, setPanel] = useState<"none" | "import" | "manual" | "model">("import");
  const [importKey, setImportKey] = useState("");
  const [qccAuthorization, setQccAuthorization] = useState("");
  const [importRegion, setImportRegion] = useState("");
  const [importStatus, setImportStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [importErrorMessage, setImportErrorMessage] = useState("");
  const [pipelineStatus, setPipelineStatus] = useState("");
  const [analysisScenario, setAnalysisScenario] =
    useState<AnalysisScenario>(emptyScenario);
  const [worldCupFacilities, setWorldCupFacilities] =
    useState<ManualWorldCupFacility[]>([]);
  const [customStadiums, setCustomStadiums] = useState<Stadium[]>([]);
  const [worldCupRegion, setWorldCupRegion] = useState("中国 · 东部候选赛区");
  const [worldCupDataNote, setWorldCupDataNote] = useState("内置场馆容量情景");
  const [manualName, setManualName] = useState("");
  const [manualType, setManualType] = useState("社区卫生服务中心");
  const [manualCapacity, setManualCapacity] = useState("1200");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [manualQuality, setManualQuality] = useState("0.85");
  const [manualOpeningYear, setManualOpeningYear] = useState(String(BASE_YEAR));
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "请先选择分析区域或手动建立居住区。数据导入完成后，我会解释价值评分、公平差距与组合选址建议。",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [toast, setToast] = useState("");
  const hasHousingData = analysisScenario.zones.length > 0;

  const generatedCandidates = useMemo(
    () =>
      generateCandidates(
        analysisScenario.parcels,
        analysisScenario.zones,
        analysisScenario.constraints,
      ),
    [
      analysisScenario.constraints,
      analysisScenario.parcels,
      analysisScenario.zones,
    ],
  );
  const tencentMapKey =
    process.env.NEXT_PUBLIC_TENCENT_MAP_KEY?.trim() ?? "";

  const housingScores = useMemo(() => {
    const modelRows = analysisScenario.zones.map((zone) => ({
      zone,
      model: housingValue(
        zone,
        analysisScenario.facilities,
        forecastYear,
        {},
        analysisScenario.regionalContext,
        analysisScenario.zones,
        analysisScenario.routeMatrix,
      ),
    }));
    const logPrices = modelRows.map(({ zone }) => Math.log(Math.max(0.01, zone.price)));
    const modelValues = modelRows.map(({ model }) => model.score);
    return modelRows.map(({ zone, model }, index) => {
      // 房价严格位于模型之外；两者分别在同城样本内标准化后再比较相对位置。
      const valueIndex = analysisScenario.hasMarketPrices
        ? standardizedIndex(model.score, modelValues)
        : model.score;
      const priceIndex = analysisScenario.hasMarketPrices
        ? standardizedIndex(logPrices[index], logPrices)
        : model.score;
      const hedonicResidual = analysisScenario.hedonicAudit?.zoneResiduals[zone.id];
      const rawResidual = hedonicResidual !== undefined
        ? hedonicResidual * 100
        : analysisScenario.hasMarketPrices
          ? priceIndex - valueIndex
          : 0;
      const residual = Math.abs(rawResidual) < 0.05 ? 0 : rawResidual;
      return {
        ...zone,
        service: model.score,
        score: model.score,
        equityScore: model.equityScore,
        rawScore: model.rawScore,
        riskMultiplier: model.riskMultiplier,
        metrics: model.metrics,
        weights: model.weights,
        transportBreakdown: model.transportBreakdown,
        interactionEffect: model.interactionEffect,
        ringScores: model.ringScores,
        valueIndex,
        priceIndex,
        residual,
        priceReason: hedonicResidual !== undefined
          ? analysisScenario.hedonicAudit?.isTemplate
            ? "当前结果来自字段示例模板，只用于验证享乐模型流程，不可解释为真实房价高估或低估。"
            : residual === 0
              ? "享乐模型控制面积、房龄、容积率、绿化率、距 CBD 和成交月份后，当前小区平均残差接近 0；这不代表模型已被充分验证。"
              : `享乐模型控制面积、房龄、容积率、绿化率、距 CBD 和成交月份后，本小区成交价仍${residual >= 0 ? "高" : "低"}于预测值约 ${Math.abs(residual).toFixed(1)}%。该结果是统计关联，不直接等同于投机溢价或市场低估。`
          : analysisScenario.hasMarketPrices
            ? explainPriceResidual(residual)
            : zone.priceReason,
      };
    });
  }, [analysisScenario, forecastYear]);

  const baseRealMapPoints = useMemo<PlanningMapPoint[]>(
    () => [
      ...housingScores.map((zone) => ({
        id: zone.id,
        name: zone.name,
        lat: zone.coord.lat,
        lng: zone.coord.lng,
        kind: "zone" as const,
        score: zone.score,
      })),
      ...analysisScenario.facilities
        .filter((facility) => isFacilityActive(facility, forecastYear))
        .map((facility) => ({
        id: facility.id,
        name: facility.name,
        lat: facility.lat,
        lng: facility.lng,
        kind: "facility" as const,
        source: facility.mapSource ?? "model",
      })),
      ...analysisScenario.constraints.map((constraint) => ({
        id: constraint.id,
        name: `${constraintLabels[constraint.kind]} · ${constraint.name}`,
        lat: constraint.lat,
        lng: constraint.lng,
        kind: "constraint" as const,
      })),
    ],
    [
      analysisScenario.constraints,
      analysisScenario.facilities,
      forecastYear,
      housingScores,
    ],
  );

  const fairness = fairnessIndex(
    housingScores.map((zone) => zone.equityScore),
    housingScores.map((zone) => projectedPopulation(zone, forecastYear)),
  );
  const equityGini = 100 - fairness;

  const activeHousing =
    housingScores.find((zone) => zone.id === activeHousingId) ??
    housingScores[0] ??
    emptyHousingView;
  const availableStadiums = useMemo(
    () => [...stadiums, ...customStadiums],
    [customStadiums],
  );
  const activeStadium = useMemo(() => {
    const base =
      availableStadiums.find((stadium) => stadium.id === activeStadiumId) ??
      availableStadiums[0];
    const additions = worldCupFacilities.filter(
      (facility) => facility.stadiumId === base.id,
    );
    const limits = { ...base.limits };
    additions.forEach((facility) => {
      limits[facility.chain] += facility.capacity;
    });
    return { ...base, limits };
  }, [activeStadiumId, availableStadiums, worldCupFacilities]);
  const hasWorldCupSpatialData = Boolean(activeStadium.coord);
  const hasImportedWorldCupData = activeStadium.dataSource === "map_import";
  const lifecycleSummary = useMemo(() => {
    const facilities = analysisScenario.facilities;
    return {
      active: facilities.filter((facility) => isFacilityActive(facility, forecastYear)).length,
      openedSinceBase: facilities.filter(
        (facility) =>
          facility.openingYear > BASE_YEAR && facility.openingYear <= forecastYear,
      ).length,
      retired: facilities.filter(
        (facility) =>
          facility.closingYear !== undefined && facility.closingYear <= forecastYear,
      ).length,
      unknownRetirement: facilities.filter(
        (facility) => facility.closingYear === undefined,
      ).length,
    };
  }, [analysisScenario.facilities, forecastYear]);
  const housingOptimization = useMemo(
    () =>
      optimizePortfolio(
        generatedCandidates,
        budget,
        fairnessWeight / 100,
        forecastYear,
        {},
        analysisScenario.zones,
        analysisScenario.facilities,
        analysisScenario.regionalContext,
        analysisScenario.routeMatrix,
      ),
    [analysisScenario, budget, fairnessWeight, forecastYear, generatedCandidates],
  );

  const recommendationMapPoints = useMemo<PlanningMapPoint[]>(
    () =>
      housingOptimization.selected.slice(0, 3).map((candidate, index) => ({
        id: candidate.id,
        name: candidate.facility,
        lat: candidate.center.lat,
        lng: candidate.center.lng,
        kind: "recommendation" as const,
        rank: index + 1,
        serviceRadiusKm: facilityTypeConfig[candidate.factor]?.serviceRadius ?? 1,
      })),
    [housingOptimization.selected],
  );

  const realMapPoints = useMemo<PlanningMapPoint[]>(
    () => [...baseRealMapPoints, ...recommendationMapPoints],
    [baseRealMapPoints, recommendationMapPoints],
  );

  const recommendationSchematicPoints = useMemo(() => {
    const selected = housingOptimization.selected.slice(0, 3);
    if (!selected.length || !analysisScenario.zones.length) return [];
    const coords = [
      ...analysisScenario.zones.map((zone) => zone.coord),
      ...selected.map((candidate) => candidate.center),
    ];
    const latitudes = coords.map((coord) => coord.lat);
    const longitudes = coords.map((coord) => coord.lng);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const latSpan = Math.max(0.001, maxLat - minLat);
    const lngSpan = Math.max(0.001, maxLng - minLng);
    return selected.map((candidate, index) => ({
      candidate,
      rank: index + 1,
      x: 12 + ((candidate.center.lng - minLng) / lngSpan) * 76,
      y: 88 - ((candidate.center.lat - minLat) / latSpan) * 76,
      radius:
        mapScale === "local"
          ? Math.min(154, Math.max(58, facilityTypeConfig[candidate.factor].serviceRadius * 24))
          : mapScale === "city"
            ? Math.min(92, Math.max(38, facilityTypeConfig[candidate.factor].serviceRadius * 9))
            : 34,
    }));
  }, [analysisScenario.zones, housingOptimization.selected, mapScale]);

  const resolvedActiveRecommendationId =
    housingOptimization.selected.some(
      (candidate) => candidate.id === activeRecommendationId,
    )
      ? activeRecommendationId
      : housingOptimization.selected[0]?.id ?? "";

  const housingRecommendations = useMemo<Recommendation[]>(() => {
    const baseEvaluation = evaluatePortfolio(
      [],
      forecastYear,
      fairnessWeight / 100,
      {},
      analysisScenario.zones,
      analysisScenario.facilities,
      analysisScenario.regionalContext,
      analysisScenario.routeMatrix,
    );
    return housingOptimization.selected.slice(0, 3).map((candidate, index) => {
      const withoutCandidate = housingOptimization.selected.filter(
        (item) => item.id !== candidate.id,
      );
      const marginalEvaluation = evaluatePortfolio(
        withoutCandidate,
        forecastYear,
        fairnessWeight / 100,
        {},
        analysisScenario.zones,
        analysisScenario.facilities,
        analysisScenario.regionalContext,
        analysisScenario.routeMatrix,
      );
      const affectedZones = analysisScenario.zones.filter(
        (_, zoneIndex) =>
          housingOptimization.evaluation.scores[zoneIndex] -
            marginalEvaluation.scores[zoneIndex] >
          0.15,
      );
      const nearestZone =
        analysisScenario.zones.find((zone) => zone.id === candidate.nearestZoneId) ??
        analysisScenario.zones[0];
      const factor = housingFactors.find(
        (item) => item.key === candidate.factor,
      )!;
      const marginalObjective =
        housingOptimization.evaluation.objective -
        marginalEvaluation.objective;
      const fairnessGain =
        housingOptimization.evaluation.fairness - baseEvaluation.fairness;
      return {
        rank: index + 1,
        type: `${ringNames[factor.ring]} · ${factor.label}`,
        title: `新建${candidate.facility}`,
        place: `${nearestZone.name}附近 · ${candidate.parcelName}`,
        impact: `净效益 +${marginalObjective.toFixed(2)} 亿元`,
        detail: `组合方案成员 · 影响 ${affectedZones.length} 个社区；成本 ${candidate.cost.toFixed(2)} 亿元，${candidate.openingYear} 年投用。场地适宜性 ${candidate.suitabilityScore.toFixed(0)}/100；${candidate.constraintNotes[0]}。组合公平指数 ${fairnessGain >= 0 ? "+" : ""}${fairnessGain.toFixed(1)}。`,
        score: Math.round(candidate.robustness),
        scoreLabel: candidate.constraintVerified ? "方案稳健度" : "初筛稳健度",
        tone: (["lime", "coral", "blue"] as const)[index],
        sourceId: candidate.id,
      };
    });
  }, [analysisScenario, fairnessWeight, forecastYear, housingOptimization]);

  const sensitivityReport = useMemo(() => {
    const samples = analysisScenario.isImported ? 18 : 48;
    const ranks = new Map<string, number[]>();
    generatedCandidates.forEach((candidate) =>
      ranks.set(candidate.id, []),
    );
    for (let sample = 0; sample < samples; sample += 1) {
      const perturbation = Object.fromEntries(
        housingFactors.map((factor) => [
          factor.key,
          1 + deterministicNoise(sample, factor.key) * 0.2,
        ]),
      );
      const sampleEquity = Math.max(
        0.2,
        Math.min(
          1,
          fairnessWeight / 100 + deterministicNoise(sample, "lambda") * 0.2,
        ),
      );
      const result = optimizePortfolio(
        generatedCandidates,
        budget,
        sampleEquity,
        forecastYear,
        perturbation,
        analysisScenario.zones,
        analysisScenario.facilities,
        analysisScenario.regionalContext,
        analysisScenario.routeMatrix,
      );
      generatedCandidates.forEach((candidate) => {
        const rank = result.selected.findIndex(
          (item) => item.id === candidate.id,
        );
        ranks.get(candidate.id)!.push(rank >= 0 ? rank + 1 : 5);
      });
    }
    return generatedCandidates
      .map((candidate) => {
        const candidateRanks = ranks.get(candidate.id)!;
        const top3Rate =
          candidateRanks.filter((rank) => rank <= 3).length / samples;
        return {
          candidate,
          top3Rate,
          meanRank:
            candidateRanks.reduce((sum, rank) => sum + rank, 0) /
            candidateRanks.length,
          rankStd: stdDev(candidateRanks),
        };
      })
      .sort(
        (a, b) =>
          b.top3Rate - a.top3Rate || a.meanRank - b.meanRank,
      )
      .slice(0, 3);
  }, [analysisScenario, budget, fairnessWeight, forecastYear, generatedCandidates]);

  const cupOptimization = useMemo(
    () =>
      optimizeWorldCupPortfolio(
        activeStadium,
        matchScenario,
        budget,
        fairnessWeight / 100,
      ),
    [activeStadium, budget, fairnessWeight, matchScenario],
  );
  const cupBaseline = useMemo(
    () =>
      evaluateWorldCupPortfolio(
        activeStadium,
        matchScenario,
        [],
        fairnessWeight / 100,
      ),
    [activeStadium, fairnessWeight, matchScenario],
  );
  const effectiveCapacity = cupBaseline.effectiveAttendance;
  const capacityRate =
    (effectiveCapacity / cupBaseline.demand.spectators) * 100;
  const cupMetrics = {
    ...activeStadium.metrics,
    transit: cupBaseline.readinessByChain.交通 * 100,
    lodging: cupBaseline.readinessByChain.住宿 * 100,
    dining: cupBaseline.readinessByChain.餐饮 * 100,
    medical: cupBaseline.readinessByChain.医疗 * 100,
    sanitary: cupBaseline.readinessByChain.公卫 * 100,
  };
  const stadiumScore = weightedScore(cupMetrics, cupFactors);

  const cupRecommendations = useMemo<Recommendation[]>(() => {
    return cupOptimization.selected.map((intervention, index) => {
      const without = cupOptimization.selected.filter(
        (item) => item.id !== intervention.id,
      );
      const previous = evaluateWorldCupPortfolio(
        activeStadium,
        matchScenario,
        without,
        fairnessWeight / 100,
      );
      const attendanceGain =
        cupOptimization.evaluation.effectiveAttendance -
        previous.effectiveAttendance;
      const idleLoss =
        intervention.cost *
        intervention.idlenessRisk *
        (1 - intervention.reuseRate) *
        1.5;
      const mainGain = Object.entries(intervention.capacityGain).sort(
        (a, b) => (b[1] ?? 0) - (a[1] ?? 0),
      )[0];
      return {
        rank: index + 1,
        type: intervention.type,
        title: intervention.title,
        place: worldCupInterventionPlace(intervention, activeStadium),
        impact: `有效承载 +${formatNumber(attendanceGain)} 人`,
        detail: `成本 ${intervention.cost.toFixed(2)} 亿元；赛后复用率 ${(intervention.reuseRate * 100).toFixed(0)}%，闲置风险 CVaR ${idleLoss.toFixed(2)} 亿元；主要补充${mainGain[0]} ${formatNumber(mainGain[1] ?? 0)}。`,
        score: Math.round(
          100 *
            (0.55 * intervention.reuseRate +
              0.45 * (1 - intervention.idlenessRisk)),
        ),
        scoreLabel: "复用稳健度",
        tone: (["lime", "blue", "coral"] as const)[index],
        sourceId: intervention.id,
      };
    });
  }, [
    activeStadium,
    cupOptimization,
    fairnessWeight,
    matchScenario,
  ]);

  const resolvedActiveCupInterventionId = cupOptimization.selected.some(
    (intervention) => intervention.id === activeCupInterventionId,
  )
    ? activeCupInterventionId
    : cupOptimization.selected[0]?.id ?? "";

  const worldCupMapPoints = useMemo<PlanningMapPoint[]>(() => {
    if (!activeStadium.coord) return [];
    const stadiumPoints: PlanningMapPoint[] = availableStadiums
      .filter((stadium) => stadium.coord)
      .map((stadium) => ({
        id: stadium.id,
        name: stadium.name,
        lat: stadium.coord!.lat,
        lng: stadium.coord!.lng,
        kind: "zone" as const,
        score: stadium.id === activeStadium.id ? stadiumScore : undefined,
        source: stadium.mapSource ?? "model",
      }));
    const facilityPoints: PlanningMapPoint[] = worldCupFacilities
      .filter((facility) => facility.stadiumId === activeStadium.id)
      .map((facility) => ({
        id: facility.id,
        name: `${facility.chain} · ${facility.name}`,
        lat: facility.coord.lat,
        lng: facility.coord.lng,
        kind: "imported" as const,
        source: facility.source === "manual" ? "model" : facility.source,
      }));
    const recommendationPoints: PlanningMapPoint[] = cupOptimization.selected.map(
      (intervention, index) => {
        const [northKm, eastKm, serviceRadiusKm] =
          worldCupInterventionOffsets[intervention.id] ?? [1 + index, 1 - index, 2];
        const coord = offsetCoord(activeStadium.coord!, northKm, eastKm);
        return {
          id: intervention.id,
          name: `${intervention.type}候选方向`,
          lat: coord.lat,
          lng: coord.lng,
          kind: "recommendation" as const,
          rank: index + 1,
          serviceRadiusKm,
          source: "model" as const,
        };
      },
    );
    return [...stadiumPoints, ...facilityPoints, ...recommendationPoints];
  }, [
    activeStadium,
    availableStadiums,
    cupOptimization.selected,
    stadiumScore,
    worldCupFacilities,
  ]);

  const factors = mode === "housing" ? housingFactors : cupFactors;
  const recommendations =
    mode === "housing" ? housingRecommendations : cupRecommendations;
  const activeMetrics =
    mode === "housing" ? activeHousing.metrics : cupMetrics;
  const currentScale = mapScales[mapScale];
  const scaleLocation = hasHousingData
    ? `${analysisScenario.region} · ${
        mapScale === "local" ? "近邻服务" : mapScale === "city" ? "城市结构" : "区域联系"
      }`
    : "尚未建立分析场景";
  const scaleTitle =
    !hasHousingData
      ? "请选择需要分析的城市或城区"
      : mapScale === "local"
      ? "社区设施精细评估"
      : mapScale === "city"
        ? "高等级服务与跨区可达"
        : "都市圈与长期背景情景";
  const markers =
    mode === "housing"
      ? !hasHousingData || analysisScenario.isImported
        ? []
        : housingMarkers.filter((marker) => marker.ring === currentScale.ring)
      : hasWorldCupSpatialData
        ? []
        : cupMarkers;

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setFactorView(nextMode === "housing" ? "all" : "core");
    setManualType(nextMode === "housing" ? "社区卫生服务中心" : "赛事旅馆");
    setManualCapacity(nextMode === "housing" ? "1200" : "1000");
    if (nextMode === "housing") setMapScale("local");
    setToast("");
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function refreshRouteMatrix(
    scenario = analysisScenario,
    profile: RouteMatrixProfile = routeProfile,
  ) {
    const profileName = routeProfileLabel(profile);
    setPipelineStatus(`正在请求${profileName}分批路网矩阵…`);
    try {
      const routeMatrix = await requestRouteMatrix(
        scenario.zones,
        scenario.facilities,
        profile,
      );
      setAnalysisScenario((current) => ({
        ...current,
        routeMatrix,
        dataNote: `${current.dataNote} 已建立 ${current.zones.length}×${routeMatrix.destinationCount} ${profileName}矩阵。`,
      }));
      setPipelineStatus(
        `${profileName}矩阵已就绪：${scenario.zones.length} 个社区 × ${routeMatrix.destinationCount} 个岗位/设施。`,
      );
      showToast(`${profileName}路网时间矩阵已更新`);
      return routeMatrix;
    } catch (error) {
      const message = error instanceof Error ? error.message : "路网矩阵获取失败。";
      setPipelineStatus(`路网矩阵未更新：${message} 当前继续使用直线距离回退。`);
      throw error;
    }
  }

  async function handleEnterpriseCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isTemplate = /template|示例/i.test(file.name);
    setImportErrorMessage("");
    setPipelineStatus("正在校验企业坐标、行业和员工数…");
    try {
      const enterprises = parseEnterpriseCsv(await file.text());
      const facilities: Facility[] = enterprises.map((enterprise) => ({
        ...enterprise,
        type: "employment",
        openingYear: BASE_YEAR,
        lifecycleSource: "planning",
        employmentSource: "enterprise_csv",
      }));
      const proxyCount = enterprises.filter((enterprise) => enterprise.usedProxyEmployment).length;
      const nextScenario: AnalysisScenario = {
        ...analysisScenario,
        facilities: [
          ...analysisScenario.facilities.filter((facility) => facility.type !== "employment"),
          ...facilities,
        ],
        employmentPoiCount: facilities.length,
        estimatedJobs: facilities.reduce((sum, facility) => sum + facility.capacity, 0),
        employmentDataStatus: isTemplate ? "template" : "enterprise",
        routeMatrix: undefined,
        dataNote: `${analysisScenario.dataNote} 已导入 ${facilities.length} 家${isTemplate ? "示例" : ""}企业的行业与岗位数据${proxyCount ? `；其中 ${proxyCount} 家缺员工数，暂按 80 岗代理` : ""}${isTemplate ? "；仅用于测试字段与算法流程" : ""}。`,
      };
      setAnalysisScenario(nextScenario);
      setPipelineStatus(`企业就业数据已导入，正在刷新路网矩阵…`);
      try {
        const routeMatrix = await requestRouteMatrix(nextScenario.zones, nextScenario.facilities);
        setAnalysisScenario((current) => ({ ...current, routeMatrix }));
        setPipelineStatus(`企业 CSV 已接入：${facilities.length} 家企业，${nextScenario.zones.length}×${routeMatrix.destinationCount} 路网矩阵。`);
      } catch (routeError) {
        setPipelineStatus(`企业 CSV 已接入；OSRM 暂不可用，岗位可达继续使用直线距离回退。`);
        console.warn(routeError);
      }
      showToast(`已导入 ${facilities.length} 家${isTemplate ? "示例" : ""}企业并重算就业多样性`);
    } catch (error) {
      setImportErrorMessage(error instanceof Error ? error.message : "企业 CSV 导入失败。");
      setPipelineStatus("");
    }
  }

  async function handleQccEmploymentCalibration() {
    const employmentFacilities = analysisScenario.facilities.filter(
      (facility) => facility.type === "employment",
    );
    if (!employmentFacilities.length) {
      setImportErrorMessage("请先导入腾讯岗位 POI 或企业 CSV，再用企查查校准主体。");
      return;
    }
    setImportErrorMessage("");
    setPipelineStatus("正在逐一锚定企业主体，并读取行业与最新年报人数…");
    try {
      const response = await fetch("/api/qcc/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companies: employmentFacilities.slice(0, 6).map((facility) => ({
            id: facility.id,
            name: facility.name,
          })),
          ...(qccAuthorization.trim()
            ? { authorization: qccAuthorization.trim() }
            : {}),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        matched?: number;
        results?: Array<{
          inputId: string;
          status: "matched" | "ambiguous" | "not_found" | "error";
          industryCategory?: string;
          employeeCount?: number;
          employeeSource?: "annual_report_employees" | "annual_social_insurance" | "unavailable";
        }>;
      };
      if (!response.ok || !payload.results) {
        throw new Error(payload.error || "企查查校准未返回结果。");
      }
      const byId = new Map(payload.results.map((item) => [item.inputId, item]));
      const disclosedEmployees = payload.results.filter(
        (item) => item.status === "matched" && item.employeeSource === "annual_report_employees",
      ).length;
      const insuredProxy = payload.results.filter(
        (item) => item.status === "matched" && item.employeeSource === "annual_social_insurance",
      ).length;
      const ambiguous = payload.results.filter((item) => item.status === "ambiguous").length;
      const unavailable = payload.results.length - (payload.matched ?? 0) - ambiguous;
      const updatedFacilities = analysisScenario.facilities.map((facility) => {
        const enrichment = byId.get(facility.id);
        if (!enrichment || enrichment.status !== "matched") return facility;
        return {
          ...facility,
          capacity: enrichment.employeeCount ?? facility.capacity,
          quality: enrichment.industryCategory ? 0.88 : facility.quality,
          industryCategory: enrichment.industryCategory ?? facility.industryCategory,
          employmentSource: "qcc_calibrated" as const,
        };
      });
      const updatedEmployment = updatedFacilities.filter((facility) => facility.type === "employment");
      setAnalysisScenario((scenario) => ({
        ...scenario,
        facilities: updatedFacilities,
        employmentPoiCount: updatedEmployment.length,
        estimatedJobs: updatedEmployment.reduce((sum, facility) => sum + facility.capacity, 0),
        employmentDataStatus: (payload.matched ?? 0) > 0 ? "qcc" : scenario.employmentDataStatus,
        employmentCalibration: {
          matched: payload.matched ?? 0,
          disclosedEmployees,
          insuredProxy,
          ambiguous,
          unavailable,
        },
        dataNote: `${scenario.dataNote} 企查查校准 ${payload.matched ?? 0}/${payload.results?.length ?? 0} 个唯一主体：${disclosedEmployees} 个采用年报从业人数、${insuredProxy} 个采用参保人数下界代理；${ambiguous} 个歧义主体未自动选择。`,
      }));
      setPipelineStatus(
        `企查查企业校准完成：唯一匹配 ${payload.matched ?? 0}，年报从业人数 ${disclosedEmployees}，参保人数代理 ${insuredProxy}，歧义未选 ${ambiguous}。`,
      );
      showToast(`企查查已校准 ${payload.matched ?? 0} 个就业点`);
    } catch (error) {
      setImportErrorMessage(error instanceof Error ? error.message : "企查查校准失败。");
      setPipelineStatus("");
    }
  }

  async function handleTransactionCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isTemplate = /template|示例/i.test(file.name);
    setImportErrorMessage("");
    setPipelineStatus("正在匹配成交记录并拟合享乐价格模型…");
    try {
      const rows = parseTransactionCsv(await file.text());
      const normalized = (value = "") => value.replace(/[\s·•（）()\-]/g, "").toLowerCase();
      const matched = rows.flatMap((row) => {
        const zone = housingScores.find(
          (item) =>
            (row.zoneId && item.id === row.zoneId) ||
            (row.zoneName &&
              (normalized(item.name) === normalized(row.zoneName) ||
                normalized(item.name).includes(normalized(row.zoneName)) ||
                normalized(row.zoneName).includes(normalized(item.name)))),
        );
        if (!zone) return [];
        return [{ ...row, zoneId: zone.id, serviceValue: zone.score }];
      });
      const audit = { ...fitHedonicModel(matched), isTemplate };
      const pricesByZone = new Map<string, number[]>();
      matched.forEach((row) => {
        const prices = pricesByZone.get(row.zoneId) ?? [];
        prices.push(row.unitPrice);
        pricesByZone.set(row.zoneId, prices);
      });
      setAnalysisScenario((scenario) => ({
        ...scenario,
        zones: scenario.zones.map((zone) => {
          const prices = [...(pricesByZone.get(zone.id) ?? [])].sort((a, b) => a - b);
          if (!prices.length) return zone;
          const median = prices[Math.floor(prices.length / 2)];
          return {
            ...zone,
            price: median > 100 ? median / 10000 : median,
            priceReason: "已由成交 CSV 的享乐价格模型校准。",
          };
        }),
        hasMarketPrices: true,
        hedonicAudit: audit,
        dataNote: `${scenario.dataNote} 享乐模型已匹配 ${audit.sampleSize} 条${isTemplate ? "示例" : "真实"}成交、${audit.zoneCount} 个小区，调整 R²=${audit.adjustedR2.toFixed(2)}${isTemplate ? "；仅验证流程，不作为实证结果" : ""}。`,
      }));
      setPipelineStatus(`享乐价格模型已完成：${audit.sampleSize} 条${isTemplate ? "示例" : "真实"}成交，${audit.zoneCount} 个小区，调整 R² ${audit.adjustedR2.toFixed(2)}${isTemplate ? "；本结果仅测试流程" : ""}。`);
      showToast(`${isTemplate ? "示例" : "真实"}成交已完成享乐价格校准`);
    } catch (error) {
      setImportErrorMessage(error instanceof Error ? error.message : "成交 CSV 导入失败。");
      setPipelineStatus("");
    }
  }

  async function handleLegalParcelGeoJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportErrorMessage("");
    setPipelineStatus("正在核验法定状态、批准文号和允许设施类型…");
    try {
      const parcels = parseLegalParcelGeoJson(await file.text());
      setAnalysisScenario((scenario) => ({
        ...scenario,
        parcels,
        parcelDataStatus: "legal",
        dataNote: `${scenario.dataNote} 已载入 ${parcels.length} 个带批准文号的法定控规地块，代理候选网格已停用。`,
      }));
      setPipelineStatus(`法定控规已接入：${parcels.length} 个地块进入用途、成本和空间冲突筛查。`);
      showToast(`已用 ${parcels.length} 个法定控规地块替换代理候选`);
    } catch (error) {
      setImportErrorMessage(error instanceof Error ? error.message : "控规 GeoJSON 导入失败。");
      setPipelineStatus("");
    }
  }

  async function handleTencentImport(event: FormEvent) {
    event.preventDefault();
    setImportStatus("loading");
    setImportErrorMessage("");
    try {
      const response = await fetch("/api/tencent/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: importKey.trim(),
          region: importRegion.trim(),
          mode,
        }),
      });
      if (!response.ok) throw new Error("import failed");
      const result = (await response.json()) as {
        region?: string;
        count?: number;
        categories?: Array<{ name?: string; count?: number; error?: string }>;
        points?: Array<{
          id?: string;
          name?: string;
          address?: string;
          category?: string;
          poiCategory?: string;
          lat?: number;
          lng?: number;
        }>;
      };
      const categoryRows = result.categories ?? [];
      const failedRows = categoryRows.filter((row) => Boolean(row.error));
      const failedShare = categoryRows.length
        ? failedRows.length / categoryRows.length
        : 1;
      if (failedShare > 0.2) {
        throw new Error(
          `腾讯地图仅完成 ${categoryRows.length - failedRows.length}/${categoryRows.length} 类检索，已阻止残缺数据进入模型，请稍后重试或更换 Key。`,
        );
      }
      if (mode === "housing") {
        const categoryFailed = (name: string) => {
          const row = categoryRows.find((item) => item.name === name);
          return !row || Boolean(row.error);
        };
        const employmentQueries = ["写字楼", "产业园", "公司企业", "商务中心"];
        const constraintQueries = ["机场", "港口", "化工园", "垃圾处理", "污水处理厂", "铁路货运站"];
        if (
          categoryFailed("住宅小区") ||
          employmentQueries.every(categoryFailed) ||
          constraintQueries.every(categoryFailed)
        ) {
          throw new Error("住宅、岗位或冲突源检索不完整，已停止分析以避免产生误导性选址建议。");
        }
      }
      const validPoints: TencentPoi[] = (result.points ?? [])
        .filter(
          (point) =>
            typeof point.lat === "number" &&
            typeof point.lng === "number",
        )
        .map((point) => ({
          id: point.id,
          name: point.name,
          address: point.address,
          category: point.category,
          poiCategory: point.poiCategory,
          lat: point.lat!,
          lng: point.lng!,
          source: "tencent",
        }));
      if (!validPoints.length) throw new Error("no valid poi");
      const resolvedRegion = result.region ?? importRegion.trim();
      let fusedPoints = validPoints;
      let fusionNote = "天地图增强暂不可用，本次仍使用腾讯位置服务完成分析。";
      try {
        const stadiumCenter = mode === "worldcup"
          ? validPoints.find(isWorldCupStadiumPoi)
          : undefined;
        const center = stadiumCenter
          ? { lat: stadiumCenter.lat, lng: stadiumCenter.lng }
          : {
              lat: validPoints.reduce((sum, point) => sum + point.lat, 0) / validPoints.length,
              lng: validPoints.reduce((sum, point) => sum + point.lng, 0) / validPoints.length,
            };
        const tdtResponse = await fetch("/api/tianditu/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ center, mode, radiusMeters: 8_000 }),
        });
        const tdtPayload = (await tdtResponse.json()) as {
          error?: string;
          points?: TencentPoi[];
        };
        if (tdtResponse.ok && tdtPayload.points?.length) {
          const fusion = fuseMapPois(validPoints, tdtPayload.points.map((point) => ({
            ...point,
            source: point.source ?? "tianditu",
          })));
          fusedPoints = fusion.points;
          fusionNote = `天地图补充 ${fusion.supplementedCount} 个权威公共设施，另有 ${fusion.crossVerifiedCount} 个点与腾讯结果交叉确认。`;
        }
      } catch {
        // 天地图是增强源；失败时不阻断腾讯底图与主分析流程。
      }
      if (mode === "worldcup") {
        const stadiumSeeds = selectDistributedPois(
          fusedPoints.filter(isWorldCupStadiumPoi),
          6,
        ).map((point, index) => ({
          id: `map-stadium-${point.id ?? index}`,
          coord: { lat: point.lat, lng: point.lng },
        }));
        if (!stadiumSeeds.length) {
          throw new Error("当前区域没有检索到可识别的体育场、足球场或体育中心，请扩大区域或手动建立场馆。");
        }
        setPipelineStatus("地图场馆已识别，正在计算场馆到赛事设施的 OSRM 行车时间…");
        let routeTimes = new Map<string, number>();
        try {
          routeTimes = await requestWorldCupRouteTimes(stadiumSeeds, fusedPoints);
        } catch {
          // 路网服务失败时保留球面距离衰减，并在来源说明中明确回退。
        }
        const imported = buildImportedWorldCupStadiums(
          resolvedRegion,
          fusedPoints,
          routeTimes,
        );
        if (!imported.facilities.length) {
          throw new Error("已找到场馆，但周边没有检索到可转换为承载能力的酒店、交通、医疗、餐饮或公卫设施。");
        }
        setCustomStadiums((items) => [
          ...items.filter((stadium) => stadium.dataSource !== "map_import"),
          ...imported.stadiums,
        ]);
        setWorldCupFacilities(imported.facilities);
        setActiveStadiumId(imported.stadiums[0].id);
        setActiveCupInterventionId("");
        setWorldCupRegion(resolvedRegion);
        setManualLat(String(imported.stadiums[0].coord!.lat));
        setManualLng(String(imported.stadiums[0].coord!.lng));
        setWorldCupDataNote(
          `融合地图识别 ${imported.stadiums.length} 座场馆和 ${imported.facilities.length} 组场馆—设施可达关系；${fusionNote} ${routeTimes.size ? "已优先使用 OSRM 行车时间" : "OSRM 暂不可用，已回退球面距离衰减"}，名义场馆容量暂按 4 万人代理。`,
        );
        setMapView("real");
        setMapScale("local");
        setImportStatus("done");
        setPanel("none");
        setPipelineStatus(
          `赛事数据链已建立：${imported.stadiums.length} 座场馆、${imported.facilities.length} 组服务关系，路网可用点 ${routeTimes.size} 个。`,
        );
        showToast(
          `已从${resolvedRegion}导入 ${imported.stadiums.length} 座场馆并重算赛事承载力`,
        );
      } else {
        const nextScenario = buildImportedScenario(resolvedRegion, fusedPoints);
        if (!nextScenario.zones.length) throw new Error("no valid zones");
        setAnalysisScenario(nextScenario);
        setActiveHousingId(nextScenario.zones[0].id);
        setManualLat(String(nextScenario.center.lat));
        setManualLng(String(nextScenario.center.lng));
        setMapView("real");
        setMapScale("local");
        setImportStatus("done");
        setPanel("none");
        setPipelineStatus("腾讯 POI 已接入，正在请求 OSRM 路网矩阵…");
        try {
          const routeMatrix = await requestRouteMatrix(
            nextScenario.zones,
            nextScenario.facilities,
          );
          setAnalysisScenario((current) => ({
            ...current,
            routeMatrix,
            dataNote: `${current.dataNote} 已建立 ${current.zones.length}×${routeMatrix.destinationCount} OSRM 行车矩阵。`,
          }));
          setPipelineStatus(`融合地图 + OSRM 已就绪：${nextScenario.zones.length}×${routeMatrix.destinationCount} 路网矩阵。${fusionNote}`);
        } catch {
          setPipelineStatus(`融合地图已接入；OSRM 公共服务暂不可用，距离暂按球面直线回退。${fusionNote}`);
        }
        showToast(`已切换到${nextScenario.region}并重算空间模型`);
      }
      setImportStatus("done");
      setPanel("none");
    } catch (error) {
      setImportStatus("error");
      setImportErrorMessage(
        error instanceof Error
          ? error.message
          : "连接失败，请检查 Key、域名白名单或配额后重试。",
      );
    }
  }

  function clearAnalysisScenario() {
    setAnalysisScenario(emptyScenario);
    setImportRegion("");
    setActiveHousingId("");
    setActiveRecommendationId("");
    setForecastYear(2030);
    setImportErrorMessage("");
    setImportStatus("idle");
    setPipelineStatus("");
    setMapScale("local");
    setMapView("real");
    setPanel("import");
    showToast("当前分析已清空，请选择新的区域");
  }

  function activateRecommendation(recommendationId: string, openRealMap = false) {
    const candidate = housingOptimization.selected.find(
      (item) => item.id === recommendationId,
    );
    if (!candidate) return;
    setActiveRecommendationId(recommendationId);
    if (openRealMap) {
      setMapScale("local");
      setMapView("real");
    }
    showToast(`已定位方案：${candidate.facility} · ${candidate.parcelName}`);
  }

  function activateCupIntervention(interventionId: string, openRealMap = false) {
    const intervention = cupOptimization.selected.find((item) => item.id === interventionId);
    if (!intervention) return;
    setActiveCupInterventionId(interventionId);
    if (openRealMap && hasWorldCupSpatialData) {
      setMapScale("local");
      setMapView("real");
    }
    const recommendation = cupRecommendations.find((item) => item.sourceId === interventionId);
    showToast(`已定位赛事方案：${intervention.type} · ${recommendation?.place ?? intervention.place}`);
  }

  function handleManualAdd(event: FormEvent) {
    event.preventDefault();
    const name = manualName.trim() || manualType;
    const capacity = Number(manualCapacity);
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    const quality = Math.max(0.1, Math.min(1, Number(manualQuality)));
    const openingYear = Math.round(Number(manualOpeningYear));
    if (
      !Number.isFinite(capacity) ||
      capacity <= 0 ||
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180 ||
      !Number.isFinite(quality) ||
      !Number.isFinite(openingYear)
    ) {
      showToast("请填写有效的容量、经纬度、品质和投用年份");
      return;
    }
    const id = `${mode}-manual-${Date.now()}`;
    const coord = { lat, lng };
    if (mode === "housing") {
      if (manualType === "新增居住区") {
        const metrics = Object.fromEntries(
          housingFactors.map((factor) => [
            factor.key,
            analysisScenario.zones.length
              ? analysisScenario.zones.reduce(
                  (sum, zone) => sum + (zone.metrics[factor.key] ?? 50),
                  0,
                ) / analysisScenario.zones.length
              : 50,
          ]),
        );
        const zone: HousingZone = {
          id,
          name,
          subtitle: "手动情景居住区 · 人口与风险待校准",
          coord,
          population: capacity / 10000,
          annualGrowth: 0.008,
          demographics: {
            elderlyRatio: 0.15,
            childRatio: 0.16,
            workingAgeRatio: 0.66,
            avgIncome: 0.7,
          },
          price: 0,
          priceReason: "新增居住区尚无同口径成交数据。",
          risks: {
            geological: 0.08,
            flood: 0.12,
            pollution: 0.1,
            industrial: 0.1,
            noise: 0.16,
          },
          metrics,
        };
        setAnalysisScenario((scenario) => ({
          ...scenario,
          region: scenario.region || "手动构建区域",
          center: scenario.zones.length ? scenario.center : coord,
          zones: [...scenario.zones, zone],
          parcels: [...scenario.parcels, ...buildProxyParcels([zone])],
          hasMarketPrices: false,
          isImported: true,
          parcelDataStatus: "proxy",
          dataNote: `${scenario.zones.length ? scenario.dataNote : "已建立手动分析场景。"} 已加入手动居住区；人口、风险和候选用地仍需校准。`,
        }));
        setActiveHousingId(id);
      } else {
        const mapping = manualHousingMapping(manualType);
        if (!mapping) {
          showToast("该设施类型尚未映射到住房模型");
          return;
        }
        const facility: Facility = {
          id,
          type: mapping.type,
          name,
          ...coord,
          capacity,
          quality,
          openingYear,
          lifecycleSource: "manual",
          transportMode: mapping.transportMode,
        };
        setAnalysisScenario((scenario) => ({
          ...scenario,
          facilities: [...scenario.facilities, facility],
          dataNote: `${scenario.dataNote} 手动设施已进入供需竞争与选址基准。`,
        }));
      }
    } else if (manualType === "新建球场") {
      const stadium: Stadium = {
        id: `manual-stadium-${Date.now()}`,
        name,
        city: `${worldCupRegion} · 手动候选场馆`,
        capacity,
        coord,
        dataSource: "manual",
        metrics: {
          transit: 50,
          lodging: 45,
          egress: 55,
          medical: 50,
          dining: 50,
          sanitary: 45,
          security: 60,
          digital: 65,
          climate: 60,
          commerce: 50,
        },
        limits: {
          交通: capacity * 0.65,
          住宿: capacity * 0.15,
          餐饮: capacity * 0.45,
          医疗: capacity * 0.12,
          公卫: capacity * 0.35,
        },
      };
      setCustomStadiums((items) => [...items, stadium]);
      setActiveStadiumId(stadium.id);
      setWorldCupDataNote("手动候选场馆已加入；基础供应链为待校准代理值。");
    } else {
      const chain = manualWorldCupChain(manualType);
      if (!chain) {
        showToast("该设施类型尚未映射到世界杯承载链");
        return;
      }
      setWorldCupFacilities((items) => [
        ...items,
        {
          id,
          stadiumId: activeStadium.id,
          name,
          chain,
          capacity,
          coord,
          source: "manual",
        },
      ]);
      setWorldCupDataNote("手动赛事设施已进入当前场馆的承载力重算。");
    }
    setManualName("");
    setPanel("none");
    showToast(`${name}已加入沙盘，模型评分已重新计算`);
  }

  function submitChat(text?: string) {
    const question = (text ?? chatInput).trim();
    if (!question) return;
    if (mode === "housing" && !hasHousingData) {
      setMessages((items) => [
        ...items,
        { role: "user", text: question },
        {
          role: "assistant",
          text: "当前还没有分析区域和社区数据。请先点击“选择分析区域”导入地图数据，或手动添加一个居住区；之后我才能基于真实场景解释评分和选址。",
        },
      ]);
      setChatInput("");
      return;
    }
    const asksAboutPrice = /房价|价格|偏差|高估|低估/.test(question);
    const context =
      mode === "housing"
        ? asksAboutPrice
          ? analysisScenario.hasMarketPrices
            ? `${activeHousing.name}的原始公共服务价值为 ${activeHousing.score.toFixed(1)}，同城标准化价值指数为 ${activeHousing.valueIndex.toFixed(1)}，房价指数为 ${activeHousing.priceIndex.toFixed(1)}，残差为 ${activeHousing.residual > 0 ? "+" : ""}${activeHousing.residual.toFixed(1)}。房价没有参与评分；偏差解释是：${activeHousing.priceReason}`
            : `${analysisScenario.region}当前只导入了腾讯 POI，没有同口径房价数据，所以我不会伪造房价指数或残差。导入小区成交均价后才能进行事后校验。`
          : housingRecommendations[0]
            ? `在 ${forecastYear} 年评估期、${budget.toFixed(1)} 亿元预算和 ${fairnessWeight}% 公平性偏好下，组合优化建议先在${housingRecommendations[0].place}建设${housingRecommendations[0].title}。它同时影响多个社区，且已经计入距离衰减、人口需求、风险折扣与全生命周期成本。`
            : `当前预算和评估年份下没有正净效益且满足硬约束的建设组合，建议延长评估期或提高预算后复算。`
        : `${activeStadium.name}在“${matchScenarios[matchScenario].label}”情景下预计到场 ${formatNumber(cupBaseline.demand.spectators)} 人，当前${cupBaseline.bottleneck}链只能支持约 ${formatNumber(effectiveCapacity)} 人。${cupRecommendations[0] ? `动态优化首先建议${cupRecommendations[0].title}。` : "当前预算内没有正净效益干预。"}推荐已计入赛后复用和闲置风险。`;
    setMessages((items) => [
      ...items,
      { role: "user", text: question },
      {
        role: "assistant",
        text: `${context} 我可以把这项建议写回方案，或继续比较“新建设施”和“新建住区/场馆”的全生命周期成本。`,
      },
    ]);
    setChatInput("");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            衡
          </span>
          <span>
            <strong>衡域</strong>
            <small>城市设施公平规划平台</small>
          </span>
        </div>

        <div className="mode-switch" aria-label="规划模式">
          <button
            className={mode === "housing" ? "active" : ""}
            onClick={() => switchMode("housing")}
          >
            <span>城市住房</span>
            <small>15 分钟生活圈</small>
          </button>
          <button
            className={mode === "worldcup" ? "active" : ""}
            onClick={() => switchMode("worldcup")}
          >
            <span>世界杯 2038</span>
            <small>场馆承载力</small>
          </button>
        </div>

        <div className="top-actions">
          <button className="connection-pill" onClick={() => setPanel("import")}>
            <span className={
              (mode === "housing" ? hasHousingData : hasImportedWorldCupData)
                ? "status-dot live"
                : "status-dot"
            } />
            {mode === "housing"
              ? hasHousingData
                ? "区域数据已连接"
                : "选择分析区域"
              : hasImportedWorldCupData
                ? "赛事数据已连接"
                : "导入赛事数据"}
          </button>
          <button className="icon-button" aria-label="查看模型说明" onClick={() => setPanel("model")}>
            ?
          </button>
          <button className="primary-button" onClick={() => setPanel("manual")}>
            <span>＋</span> 手动添加
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="control-rail">
          <div className="rail-heading">
            <span className="eyebrow">决策控制台</span>
          </div>

          <div className="control-group">
            <label htmlFor="fairness">
              <span>{mode === "housing" ? "公平性偏好" : "赛后利用权重"}</span>
              <strong>{fairnessWeight}%</strong>
            </label>
            <input
              id="fairness"
              type="range"
              min="20"
              max="100"
              value={fairnessWeight}
              onChange={(event) => setFairnessWeight(Number(event.target.value))}
            />
            <div className="range-labels">
              <span>{mode === "housing" ? "效率优先" : "赛事优先"}</span>
              <span>{mode === "housing" ? "均衡优先" : "遗产优先"}</span>
            </div>
          </div>

          <div className="control-group budget">
            <label htmlFor="budget">
              <span>本轮可用预算</span>
              <strong>{budget.toFixed(1)} 亿元</strong>
            </label>
            <input
              id="budget"
              type="range"
              min="0.8"
              max="9"
              step="0.1"
              value={budget}
              onChange={(event) => setBudget(Number(event.target.value))}
            />
            <p>约束：建设成本、土地适宜性、设施服务半径</p>
          </div>

          {mode === "housing" ? (
            <div className="scenario-control">
              <label htmlFor="forecast-year">评估年份</label>
              <select
                id="forecast-year"
                value={forecastYear}
                onChange={(event) => setForecastYear(Number(event.target.value))}
              >
                <option value={2026}>2026 · 当前快照</option>
                <option value={2030}>2030 · 中期规划</option>
                <option value={2035}>2035 · 国土空间远景</option>
              </select>
              <div className="lifecycle-summary">
                <span><b>{lifecycleSummary.active}</b>当年在用</span>
                <span><b>+{lifecycleSummary.openedSinceBase}</b>期间投用</span>
                <span><b>−{lifecycleSummary.retired}</b>期间退役</span>
              </div>
              <small>
                年份只启用有明确 openingYear 的设施、排除 closingYear 已到的设施，并预测人口需求；{lifecycleSummary.unknownRetirement} 项设施没有退役年份，暂按持续存在但不代表永不拆除。
              </small>
            </div>
          ) : (
            <div className="scenario-control">
              <label htmlFor="active-stadium">评估场馆</label>
              <select
                id="active-stadium"
                value={activeStadiumId}
                onChange={(event) => setActiveStadiumId(event.target.value)}
              >
                {availableStadiums.map((stadium) => (
                  <option value={stadium.id} key={stadium.id}>
                    {stadium.name} · {formatNumber(stadium.capacity)} 人
                  </option>
                ))}
              </select>
              <label htmlFor="match-scenario">赛事需求情景</label>
              <select
                id="match-scenario"
                value={matchScenario}
                onChange={(event) =>
                  setMatchScenario(event.target.value as MatchScenarioKey)
                }
              >
                {Object.entries(matchScenarios).map(([key, scenario]) => (
                  <option value={key} key={key}>{scenario.label}</option>
                ))}
              </select>
              <small>{worldCupDataNote} 观众规模、外地客比例与多场并发会同步改变需求链。</small>
            </div>
          )}

          {mode === "housing" && (hasHousingData ? (
            <div className={`data-provenance ${analysisScenario.isImported || analysisScenario.parcelDataStatus === "proxy" ? "proxy" : "demo"}`}>
              <div>
                <b>{analysisScenario.region}</b>
                <span>
                  {analysisScenario.isImported
                    ? "外部数据场景"
                    : analysisScenario.hedonicAudit || analysisScenario.parcelDataStatus === "legal"
                      ? analysisScenario.hedonicAudit?.isTemplate || analysisScenario.employmentDataStatus === "template"
                        ? "模板试算场景"
                        : "已校准场景"
                      : "当前分析场景"}
                </span>
              </div>
              <p>{analysisScenario.dataNote}</p>
              <div className="provenance-stats">
                <span><b>{analysisScenario.employmentPoiCount}</b>{analysisScenario.employmentDataStatus === "template" ? "示例就业点" : "就业点"}</span>
                <span><b>{analysisScenario.employmentDataStatus === "qcc" ? "企查查" : analysisScenario.employmentDataStatus === "enterprise" ? "企业表" : analysisScenario.employmentDataStatus === "poi_proxy" ? "POI代理" : "未校准"}</b>岗位口径</span>
                <span><b>{analysisScenario.routeMatrix ? "路网+直线" : "直线"}</b>距离口径</span>
                <span><b>{analysisScenario.hedonicAudit ? analysisScenario.hedonicAudit.sampleSize : 0}</b>{analysisScenario.hedonicAudit?.isTemplate ? "示例成交" : "成交样本"}</span>
                <span><b>{analysisScenario.parcelDataStatus === "legal" ? "法定" : analysisScenario.parcelDataStatus === "proxy" ? "代理" : "未导入"}</b>控规地块</span>
              </div>
              <button onClick={() => setPanel("import")}>更换分析区域</button>
            </div>
          ) : (
            <div className="empty-rail-state">
              <span className="empty-rail-icon"><MapPinned size={20} /></span>
              <b>尚未选择分析区域</b>
              <p>选择任意城市、城区或街道后，再计算设施价值、公平性与组合选址。</p>
              <button onClick={() => setPanel("import")}>选择分析区域</button>
            </div>
          ))}

          {mode === "worldcup" && hasImportedWorldCupData && (
            <div className="data-provenance proxy">
              <div>
                <b>{worldCupRegion}</b>
                <span>融合地图赛事场景</span>
              </div>
              <p>{worldCupDataNote}</p>
              <div className="provenance-stats">
                <span><b>{customStadiums.filter((stadium) => stadium.dataSource === "map_import").length}</b>地图场馆</span>
                <span><b>{worldCupFacilities.filter((facility) => facility.stadiumId === activeStadium.id).length}</b>周边设施</span>
                <span><b>{worldCupFacilities.filter((facility) => facility.stadiumId === activeStadium.id && facility.routeMinutes !== undefined).length}</b>路网校准</span>
                <span><b>{worldCupFacilities.filter((facility) => facility.source === "tianditu").length}</b>天地图补充</span>
                <span><b>{worldCupFacilities.filter((facility) => facility.source === "cross_verified").length}</b>双源确认</span>
              </div>
              <button onClick={() => setPanel("import")}>更换赛事区域</button>
            </div>
          )}

          {(mode !== "housing" || hasHousingData) && <div className="factor-heading">
            <span>评估变量</span>
            <button onClick={() => setFactorView(factorView === "core" ? "all" : "core")}>
              {factorView === "core" ? `展开 ${housingFactors.length} 项` : "收起"}
            </button>
          </div>}

          {(mode !== "housing" || hasHousingData) && <div className="factor-list">
            {factors.slice(0, factorView === "core" ? 9 : factors.length).map((factor) => {
              const score = activeMetrics[factor.key] ?? 0;
              const FactorIcon = factorIcons[factor.key] ?? MapPinned;
              return (
                <div className="factor-row" key={factor.key}>
                  <span className="factor-icon" aria-hidden="true">
                    <FactorIcon size={14} strokeWidth={1.9} />
                  </span>
                  <span className="factor-copy">
                    <span>
                      {factor.label}
                      <small>
                        {"ring" in factor
                          ? `${factor.ring === "inner" ? "内" : factor.ring === "middle" ? "中" : "外"} · ${factor.key === "employment" && analysisScenario.isImported ? analysisScenario.routeMatrix ? "近邻岗位路网 + 其余直线" : "岗位 POI 重力模型" : factor.radius} · 权重 ${activeHousing.weights[factor.key].toFixed(1)}`
                          : factor.radius}
                      </small>
                    </span>
                    <i>
                      <b style={{ width: `${score}%` }} />
                    </i>
                  </span>
                  <strong>{Math.round(score)}</strong>
                </div>
              );
            })}
          </div>}

          {factorView === "all" && mode === "housing" && hasHousingData && (
            <div className="extended-factors">
              <span>空间—人群—风险联合模型</span>
              <p>内圈由设施坐标、容量、品质和距离衰减计算；权重随人口结构变化，最终价值再乘多维风险折扣。</p>
            </div>
          )}

          {mode === "housing" && hasHousingData && (
            <div className="transport-breakdown">
              <div>
                <span>综合交通构成</span>
                <b>{activeHousing.metrics.transit.toFixed(0)}</b>
              </div>
              {[
                ["步行", activeHousing.transportBreakdown.walking],
                ["自行车", activeHousing.transportBreakdown.cycling],
                ["公交 / BRT", activeHousing.transportBreakdown.bus],
                ["地铁", activeHousing.transportBreakdown.metro],
                ["道路驾车", activeHousing.transportBreakdown.road],
                ["轮渡 / 城际", activeHousing.transportBreakdown.ferryRail],
              ].map(([label, value]) => (
                <span key={String(label)}>
                  <small>{label}</small>
                  <strong>{Number(value).toFixed(0)}</strong>
                </span>
              ))}
              <details>
                <summary>为什么是这些分数？</summary>
                <p>
                  0–100 表示“容量校准后的可达性满足度”，50 代表刚好达到标定供给阈值；不是速度、公里数或出行比例。
                </p>
                <ul>
                  <li>步行 = 36%购物({activeHousing.metrics.retail.toFixed(0)}) + 30%绿地({activeHousing.metrics.green.toFixed(0)}) + 34%安全({activeHousing.metrics.safety.toFixed(0)}) = {activeHousing.transportBreakdown.walking.toFixed(0)}</li>
                  <li>骑行 = 56%自行车站({activeHousing.transportBreakdown.bikeInfrastructure.toFixed(0)}) + 26%绿地 + 18%安全 = {activeHousing.transportBreakdown.cycling.toFixed(0)}</li>
                  <li>公交/BRT = 62%公交站({activeHousing.transportBreakdown.busNode.toFixed(0)}) + 38%BRT({activeHousing.transportBreakdown.brtNode.toFixed(0)}) = {activeHousing.transportBreakdown.bus.toFixed(0)}</li>
                  <li>地铁按 3.5km 特征距离、站点容量和品质单独计算 = {activeHousing.transportBreakdown.metro.toFixed(0)}</li>
                  <li>驾车代理 = 岗位32% + 区域交通28% + 物流20% + 安全10% + 低噪声10% = {activeHousing.transportBreakdown.road.toFixed(0)}</li>
                  <li>轮渡/城际分别使用 5.5km / 18km 衰减后，按 45% / 55% 合成 = {activeHousing.transportBreakdown.ferryRail.toFixed(0)}</li>
                </ul>
              </details>
            </div>
          )}

          <button className="model-link" onClick={() => setPanel("model")}>
            <span>ƒ</span>
            <span>
              查看模型与公式
              <small>空间衰减 · 组合优化 · 敏感性检验</small>
            </span>
            <b>→</b>
          </button>
        </aside>

        <section className="map-stage">
          <div className="map-toolbar">
            <div>
              <span className="eyebrow">
                {mode === "housing" ? scaleLocation : worldCupRegion}
              </span>
              <h1>
                {mode === "housing"
                  ? scaleTitle
                  : mapView === "real" && hasWorldCupSpatialData
                    ? "赛事设施承载力实景"
                    : "赛事设施承载力沙盘"}
              </h1>
            </div>
            <div className="map-actions">
              <button
                disabled={
                  (mode === "housing" && !hasHousingData) ||
                  (mode === "worldcup" && !hasWorldCupSpatialData)
                }
                onClick={() => {
                  setMapScale("city");
                  showToast("已切换到城市尺度查看全部分析对象");
                }}
              >⌖ 全域</button>
              <button onClick={() => setPanel("import")}>⇩ 导入数据</button>
              {((mode === "housing" && hasHousingData) ||
                (mode === "worldcup" && hasWorldCupSpatialData)) && (
                <button
                  className={mapView === "real" ? "active" : ""}
                  onClick={() =>
                    setMapView(mapView === "real" ? "schematic" : "real")
                  }
                >
                  ▱ {mapView === "real" ? "真实地图" : "分析沙盘"}
                </button>
              )}
            </div>
          </div>

          <div
            className={`map-canvas ${mode} zoom-${mapScale} ${
              mapView === "real" &&
              ((mode === "housing" && hasHousingData) ||
                (mode === "worldcup" && hasWorldCupSpatialData))
                ? "real-map"
                : ""
            }`}
          >
            {mode === "housing" && hasHousingData && mapView === "real" && (
              <TencentPlanningMap
                apiKey={tencentMapKey}
                scale={mapScale}
                center={analysisScenario.center}
                points={realMapPoints}
                activeZoneId={activeHousingId}
                activeRecommendationId={resolvedActiveRecommendationId}
                onZoneSelect={setActiveHousingId}
                onRecommendationSelect={(recommendationId) =>
                  activateRecommendation(recommendationId)
                }
                captionTitle="真实路网与跨源公共设施"
                captionDetail="腾讯矢量底图 · 天地图补充与交叉确认"
              />
            )}
            {mode === "worldcup" && hasWorldCupSpatialData && mapView === "real" && activeStadium.coord && (
              <TencentPlanningMap
                apiKey={tencentMapKey}
                scale={mapScale}
                center={activeStadium.coord}
                points={worldCupMapPoints}
                activeZoneId={activeStadiumId}
                activeRecommendationId={resolvedActiveCupInterventionId}
                onZoneSelect={setActiveStadiumId}
                onRecommendationSelect={(interventionId) =>
                  activateCupIntervention(interventionId)
                }
                captionTitle="世界杯场馆与赛事设施实景"
                captionDetail="场馆、酒店、交通、医疗、餐饮与公卫承载点"
              />
            )}
            {mode === "housing" && hasHousingData && mapView === "real" && analysisScenario.isImported && (
              <div className="map-source-legend" aria-label="融合数据来源图例">
                <span><i className="source-tencent" />腾讯位置</span>
                <span><i className="source-tianditu" />天地图补充</span>
                <span><i className="source-verified" />双源确认</span>
              </div>
            )}
            {mode === "housing" && hasHousingData && housingOptimization.selected.length > 0 && (
              <div className="optimization-map-status">
                <span>组合建议已上图</span>
                <b>{housingOptimization.selected.length} 处</b>
                <small>编号与右侧卡片一致 · 圆圈为设施服务半径</small>
              </div>
            )}
            {mode === "worldcup" && hasWorldCupSpatialData && mapView === "real" && cupOptimization.selected.length > 0 && (
              <div className="optimization-map-status">
                <span>赛事组合建议已上图</span>
                <b>{cupOptimization.selected.length} 处</b>
                <small>编号与右侧卡片一致 · 方向点需结合控规地块进一步核验</small>
              </div>
            )}
            {mode === "worldcup" && hasImportedWorldCupData && mapView === "real" && (
              <div className="map-source-legend" aria-label="世界杯融合数据来源图例">
                <span><i className="source-tencent" />腾讯位置</span>
                <span><i className="source-tianditu" />天地图补充</span>
                <span><i className="source-verified" />双源确认</span>
              </div>
            )}
            {mode === "housing" && !hasHousingData && (
              <div className="analysis-empty-map">
                <span className="analysis-empty-icon"><MapPinned size={30} /></span>
                <small>START A NEW ANALYSIS</small>
                <h2>先选择需要分析的区域</h2>
                <p>这里不会预载任何城市的演示数据。可从地图服务导入任意城市或城区，也可以手动建立场景。</p>
                <div className="analysis-empty-actions">
                  <button onClick={() => setPanel("import")}>选择分析区域</button>
                  <button className="secondary" onClick={() => setPanel("manual")}>手动构建</button>
                </div>
              </div>
            )}
            {(mode !== "housing" || hasHousingData) && <div className="map-grid" />}
            {(mode !== "housing" || hasHousingData) && <div className="water-shape" />}
            {(mode !== "housing" || hasHousingData) && <div className="road road-one" />}
            {(mode !== "housing" || hasHousingData) && <div className="road road-two" />}
            {(mode !== "housing" || hasHousingData) && <div className="road road-three" />}

            {mode === "housing" && hasHousingData && (
              <div
                className="transport-network"
                role="img"
                aria-label="步行、自行车、公交、BRT、地铁、道路、轮渡与城际交通网络"
              >
                <div className="transport-layer local-transport">
                  <i className="transport-line walk-line walk-a" />
                  <i className="transport-line walk-line walk-b" />
                  <i className="transport-line cycle-line cycle-a" />
                  <i className="transport-line bus-line bus-a" />
                  <i className="transport-line bus-line bus-b" />
                  <i className="transport-line metro-line metro-a" />
                  <span className="transport-stop metro-stop stop-a">M</span>
                  <span className="transport-stop metro-stop stop-b">M</span>
                  <span className="transport-stop bus-stop stop-c">B</span>
                  <span className="route-tag local-tag-a">{analysisScenario.isImported ? "公交服务走廊" : "公交 6 路"}</span>
                  <span className="route-tag local-tag-b">骑行绿道</span>
                  <span className="route-tag local-tag-c">{analysisScenario.isImported ? "轨道站点服务" : "地铁支线"}</span>
                </div>
                <div className="transport-layer city-transport">
                  <i className="transport-line city-metro city-metro-a" />
                  <i className="transport-line city-brt city-brt-a" />
                  <i className="transport-line city-road city-road-a" />
                  <i className="transport-line city-ferry city-ferry-a" />
                  <span className="route-tag city-tag-a">{analysisScenario.isImported ? "城市轨道骨架" : "地铁 2 / 3 号线"}</span>
                  <span className="route-tag city-tag-b">BRT 主走廊</span>
                  <span className="route-tag city-tag-c">{analysisScenario.isImported ? "城市快速路" : "跨海快速路"}</span>
                  <span className="route-tag city-tag-d">{analysisScenario.isImported ? "水运 / 补充交通" : "轮渡航线"}</span>
                </div>
                <div className="transport-layer region-transport">
                  <i className="transport-line regional-rail regional-rail-a" />
                  <i className="transport-line regional-road regional-road-a" />
                  <i className="transport-line regional-road regional-road-b" />
                  <span className="route-tag region-tag-a">{analysisScenario.isImported ? "区域铁路" : "沿海高铁"}</span>
                  <span className="route-tag region-tag-b">{analysisScenario.isImported ? "国家高速" : "沈海高速"}</span>
                  <span className="route-tag region-tag-c">{analysisScenario.isImported ? "都市圈通道" : "厦蓉通道"}</span>
                </div>
              </div>
            )}

            {mode === "housing" && hasHousingData && (
              <>
                <div className="semantic-scale">
                  <strong>{currentScale.label}</strong>
                  <span>{currentScale.range}</span>
                  <small>{currentScale.note}</small>
                </div>
                <div className="zoom-control" aria-label="地图语义缩放">
                  <button
                    aria-label="放大到更精细层级"
                    disabled={mapScale === "local"}
                    onClick={() =>
                      setMapScale(mapScale === "region" ? "city" : "local")
                    }
                  >
                    +
                  </button>
                  <div>
                    {(["local", "city", "region"] as const).map((scale) => (
                      <button
                        key={scale}
                        className={mapScale === scale ? "active" : ""}
                        aria-label={`切换到${mapScales[scale].label}`}
                        onClick={() => setMapScale(scale)}
                      />
                    ))}
                  </div>
                  <button
                    aria-label="缩小到更宏观层级"
                    disabled={mapScale === "region"}
                    onClick={() =>
                      setMapScale(mapScale === "local" ? "city" : "region")
                    }
                  >
                    −
                  </button>
                </div>
              </>
            )}

            {mode === "worldcup" && hasWorldCupSpatialData && mapView === "real" && (
              <div className="zoom-control" aria-label="赛事地图缩放">
                <button
                  aria-label="放大赛事地图"
                  disabled={mapScale === "local"}
                  onClick={() => setMapScale(mapScale === "region" ? "city" : "local")}
                >+</button>
                <div>
                  {(["local", "city", "region"] as const).map((scale) => (
                    <button
                      key={scale}
                      className={mapScale === scale ? "active" : ""}
                      aria-label={`切换到${mapScales[scale].label}`}
                      onClick={() => setMapScale(scale)}
                    />
                  ))}
                </div>
                <button
                  aria-label="缩小赛事地图"
                  disabled={mapScale === "region"}
                  onClick={() => setMapScale(mapScale === "local" ? "city" : "region")}
                >−</button>
              </div>
            )}

            {mode === "housing" ? (hasHousingData ? (
              mapScale === "local" ? (
                <>
                  {analysisScenario.zones.slice(0, 5).map((zone, index) => (
                    <button
                      key={zone.id}
                      className={`zone zone-${String.fromCharCode(97 + index)} ${activeHousingId === zone.id ? "active" : ""}`}
                      onClick={() => setActiveHousingId(zone.id)}
                      aria-label={`选择${zone.name}`}
                    >
                      <span>{zone.name}</span>
                    </button>
                  ))}
                </>
              ) : mapScale === "city" ? (
                <div className="city-overview" aria-label={`${analysisScenario.region}城市级影响范围`}>
                  <span className="city-zone island">{analysisScenario.isImported ? analysisScenario.region : "厦门本岛"}<small>核心服务与岗位</small></span>
                  <span className="city-zone west">{analysisScenario.isImported ? "相邻城区 A" : "海沧—集美"}<small>产业、高校与高等级服务</small></span>
                  <span className="city-zone east">{analysisScenario.isImported ? "相邻城区 B" : "同安—翔安"}<small>新城、枢纽与增长轴</small></span>
                  <i className="commute-line line-a" />
                  <i className="commute-line line-b" />
                </div>
              ) : (
                <div className="region-overview" aria-label={`${analysisScenario.region}区域联系`}>
                  <span className="regional-context-note">
                    {analysisScenario.region}各社区共享此层数值 · 跨城市或新城选址时才产生区分
                  </span>
                  <span className="region-node fuzhou"><b>{analysisScenario.isImported ? "省域中心" : "福州"}</b><small>高等级资源</small></span>
                  <span className="region-node quanzhou"><b>{analysisScenario.isImported ? "产业节点" : "泉州"}</b><small>产业与就业</small></span>
                  <span className="region-node xiamen"><b>{analysisScenario.isImported ? analysisScenario.region : "厦门"}</b><small>分析区域</small></span>
                  <span className="region-node zhangzhou"><b>{analysisScenario.isImported ? "邻近城市" : "漳州"}</b><small>居住协同</small></span>
                  <span className="region-node longyan"><b>{analysisScenario.isImported ? "生态腹地" : "龙岩"}</b><small>生态与韧性</small></span>
                  <i className="region-link link-a" />
                  <i className="region-link link-b" />
                  <i className="region-link link-c" />
                </div>
              )) : null
            ) : mapView === "real" && hasWorldCupSpatialData ? null : (
              <div className="stadium-ring" aria-label="场馆服务范围">
                <span className="ring-label">5km 服务圈</span>
                <button className="stadium-core" onClick={() => showToast(`${activeStadium.name}已设为当前评估场馆`)}>
                  <b>{Math.round(activeStadium.capacity / 1000)}K</b>
                  <small>{activeStadium.name}</small>
                </button>
              </div>
            )}

            {markers.map((marker) => (
              <button
                key={marker.label}
                className={`map-marker ${marker.tone} ${marker.ring}`}
                style={
                  {
                    "--marker-x": `${marker.x}%`,
                    "--marker-y": `${marker.y}%`,
                  } as CSSProperties
                }
                onClick={() => showToast(`${marker.label}：已加入当前分析焦点`)}
              >
                <span>{marker.icon}</span>
                <small>{marker.label}</small>
              </button>
            ))}

            {mode === "worldcup" && (!hasWorldCupSpatialData || mapView === "schematic") && worldCupFacilities
              .filter((facility) => facility.stadiumId === activeStadium.id)
              .slice(0, 8)
              .map((facility, index) => (
              <button
                className="map-marker custom"
                key={facility.id}
                style={
                  {
                    "--marker-x": `${52 + index * 5}%`,
                    "--marker-y": `${52 - index * 4}%`,
                  } as CSSProperties
                }
                onClick={() =>
                  showToast(`${facility.name} · ${facility.chain} +${formatNumber(facility.capacity)}`)
                }
              >
                <span>新</span>
                <small>{facility.name}</small>
              </button>
            ))}

            {mode === "housing" && hasHousingData && mapView === "schematic" &&
              recommendationSchematicPoints.map(({ candidate, rank, x, y, radius }) => (
                <button
                  key={candidate.id}
                  className={`proposed-site ${resolvedActiveRecommendationId === candidate.id ? "active" : ""}`}
                  style={
                    {
                      "--site-x": `${x}%`,
                      "--site-y": `${y}%`,
                      "--service-diameter": `${radius}px`,
                    } as CSSProperties
                  }
                  aria-pressed={resolvedActiveRecommendationId === candidate.id}
                  aria-label={`方案 ${rank}：${candidate.facility}，${candidate.parcelName}`}
                  onClick={() => activateRecommendation(candidate.id)}
                >
                  <i>0{rank}</i>
                  <span>{candidate.facility}</span>
                  <small>{candidate.parcelName}</small>
                </button>
              ))}

            {(mode !== "housing" || hasHousingData) && <div className="map-legend">
              {mode === "housing" ? (
                mapView === "real" ? (
                  <>
                    <span><i className="legend-node real-zone" />社区价值点</span>
                    <span><i className="legend-node real-facility" />设施 / POI</span>
                    <span><i className="legend-proposed" />组合建议与服务圈</span>
                    <span><i className="legend-constraint" />机场 / 港口等避让源</span>
                    <span><i className="legend-line road" />真实路网</span>
                    <span><i className="legend-water" />海岸线与水域</span>
                  </>
                ) : mapScale === "local" ? (
                  <>
                    <span><i className="legend-line walk" />步行支路</span>
                    <span><i className="legend-line cycle" />自行车绿道</span>
                    <span><i className="legend-line bus" />公交 / BRT</span>
                    <span><i className="legend-line metro" />地铁与站点</span>
                    <span><i className="legend-proposed" />组合建议</span>
                  </>
                ) : mapScale === "city" ? (
                  <>
                    <span><i className="legend-line metro" />地铁</span>
                    <span><i className="legend-line brt" />BRT</span>
                    <span><i className="legend-line road" />快速路</span>
                    <span><i className="legend-line ferry" />跨海轮渡</span>
                    <span><i className="legend-proposed" />组合建议</span>
                  </>
                ) : (
                  <>
                    <span><i className="legend-line rail" />高铁 / 城际</span>
                    <span><i className="legend-line road" />高速公路</span>
                    <span><i className="legend-node" />城市节点</span>
                    <span><i className="legend-context" />共享区域背景</span>
                    <span><i className="legend-proposed" />组合建议</span>
                  </>
                )
              ) : mapView === "real" && hasWorldCupSpatialData ? (
                <>
                  <span><i className="legend-node real-zone" />场馆与准备度</span>
                  <span><i className="legend-node real-facility" />赛事设施 / POI</span>
                  <span><i className="legend-proposed" />动态干预方向（待控规核验）</span>
                  <span><i className="legend-line road" />真实路网可达</span>
                </>
              ) : (
                <>
                  <span><i className="legend-high" />高承载</span>
                  <span><i className="legend-mid" />中承载</span>
                  <span><i className="legend-low" />瓶颈</span>
                  <span><i className="legend-proposed" />建议选址</span>
                </>
              )}
            </div>}
          </div>

          <div className="score-strip">
            {mode === "housing" ? (hasHousingData ? (
              <>
                <div className="score-main">
                  <span className="score-badge">{Math.round(activeHousing.score)}</span>
                  <span>
                    <strong>{activeHousing.name}</strong>
                    <small>{activeHousing.subtitle}</small>
                  </span>
                </div>
                <div className="score-stat">
                  <span>{forecastYear} 年综合居住价值</span>
                  <strong>{activeHousing.score.toFixed(1)}</strong>
                  <small>
                    区域背景 {activeHousing.ringScores.outer.toFixed(0)}（同城共享）· 风险 ×{activeHousing.riskMultiplier.toFixed(2)}
                  </small>
                </div>
                <div className="score-stat">
                  <span>市场房价 · 仅用于验证</span>
                  {analysisScenario.hasMarketPrices ? (
                    <>
                      <strong>{activeHousing.price.toFixed(1)} 万</strong>
                      <small>
                        同城价值指数 {activeHousing.valueIndex.toFixed(0)} · 价格指数 {activeHousing.priceIndex.toFixed(0)} · 偏差 {activeHousing.residual > 0 ? "+" : ""}{activeHousing.residual.toFixed(1)}
                      </small>
                    </>
                  ) : (
                    <>
                      <strong>待导入</strong>
                      <small>未用演示价格替代真实市场数据</small>
                    </>
                  )}
                </div>
                <div className="score-stat warning">
                  <span>最大短板</span>
                  <strong>
                    {
                      [...housingFactors].sort(
                        (a, b) =>
                          (100 - activeHousing.metrics[b.key]) *
                            activeHousing.weights[b.key] -
                          (100 - activeHousing.metrics[a.key]) *
                            activeHousing.weights[a.key],
                      )[0].label
                    }
                  </strong>
                  <small>人口自适应权重 × 空间供需缺口</small>
                </div>
              </>
            ) : (
              <div className="score-empty-state">
                <span>等待分析区域</span>
                <strong>导入区域后生成价值、公平性与选址结果</strong>
              </div>
            )) : (
              <>
                <div className="score-main">
                  <span className="score-badge coral">{Math.round(stadiumScore)}</span>
                  <span>
                    <strong>{activeStadium.name}</strong>
                    <small>{activeStadium.city}</small>
                  </span>
                </div>
                <div className="score-stat">
                  <span>名义容量</span>
                  <strong>{formatNumber(activeStadium.capacity)} 人</strong>
                  <small>固定设施上限</small>
                </div>
                <div className="score-stat danger">
                  <span>周边承载</span>
                  <strong>{formatNumber(effectiveCapacity)} 人</strong>
                  <small>由最弱设施链决定</small>
                </div>
                <div className="score-stat warning">
                  <span>可用率</span>
                  <strong>{capacityRate.toFixed(0)}%</strong>
                  <small>当前瓶颈：{cupBaseline.bottleneck}</small>
                </div>
              </>
            )}
          </div>
        </section>

        <aside className="insight-rail">
          <div className="insight-header">
            <span>
              <i className="pulse" />
              优化引擎
            </span>
            <small>{mode === "housing" && !hasHousingData ? "等待区域" : "刚刚更新"}</small>
          </div>

          {mode === "housing" && !hasHousingData ? (
            <section className="insight-empty-state">
              <span><MapPinned size={22} /></span>
              <h2>优化引擎等待数据</h2>
              <p>选择分析区域后，系统才会计算公平指数、敏感性与组合选址，避免把空场景显示为 0 分。</p>
              <button onClick={() => setPanel("import")}>开始选择区域</button>
            </section>
          ) : (<>
          <section className="fairness-card">
            <div className="fairness-top">
              <span>
                <small>{mode === "housing" ? "区内设施公平指数" : "场馆准备度"}</small>
                <strong>{mode === "housing" ? fairness.toFixed(1) : capacityRate.toFixed(1)}</strong>
              </span>
              <div
                className="donut"
                style={
                  {
                    "--progress": `${mode === "housing" ? fairness : capacityRate}%`,
                  } as CSSProperties
                }
              >
                <span>{mode === "housing" ? "均衡" : "承载"}</span>
              </div>
            </div>
            <div className="fairness-scale">
              <i>
                <b
                  style={{
                    width: `${mode === "housing" ? fairness : capacityRate}%`,
                  }}
                />
              </i>
              <div><span>失衡</span><span>目标 ≥ 80</span><span>均衡</span></div>
            </div>
            <p>
              {mode === "housing"
                ? `采用人口加权 Gini 互补指数；当前不平等度 ${equityGini.toFixed(1)}%。同一区共享的区域背景不参与小区公平比较，避免把共同加分误当成均衡改善。`
                : `${matchScenarios[matchScenario].label}预计到场 ${formatNumber(cupBaseline.demand.spectators)} 人；${cupBaseline.bottleneck}是当前最弱需求链。`}
            </p>
          </section>

          {mode === "housing" && analysisScenario.hasMarketPrices && (
            <section className="price-audit-card">
              <div className="price-audit-head">
                <span>房价事后校验</span>
                <b>不进入评分</b>
              </div>
              <div className="audit-row">
                <span>同城价值指数</span>
                <i><b style={{ width: `${activeHousing.valueIndex.toFixed(3)}%` }} /></i>
                <strong>{activeHousing.valueIndex.toFixed(1)}</strong>
              </div>
              <div className="audit-row market">
                <span>房价指数</span>
                <i><b style={{ width: `${activeHousing.priceIndex.toFixed(3)}%` }} /></i>
                <strong>{activeHousing.priceIndex.toFixed(1)}</strong>
              </div>
              <div className={`residual ${Math.abs(activeHousing.residual) >= 8 ? "large" : ""}`}>
                <span>
                  {Math.abs(activeHousing.residual) < 8
                    ? "价值与房价基本相符"
                    : activeHousing.residual > 0
                      ? "房价高于设施价值"
                      : "模型价值高于房价"}
                </span>
                <strong>
                  {activeHousing.residual > 0 ? "+" : ""}
                  {activeHousing.residual.toFixed(1)}
                </strong>
              </div>
              <p>{activeHousing.priceReason}</p>
            </section>
          )}

          {mode === "housing" && (
            <section className="sensitivity-card">
              <div className="price-audit-head">
                <span>±20% 敏感性分析</span>
                <b>{analysisScenario.isImported ? "18 次情景" : "48 次情景"}</b>
              </div>
              {sensitivityReport.map((item) => (
                <div className="sensitivity-row" key={item.candidate.id}>
                  <span>
                    <strong>{item.candidate.facility}</strong>
                    <small>{item.candidate.parcelId}</small>
                  </span>
                  <i>
                    <b style={{ width: `${item.top3Rate * 100}%` }} />
                  </i>
                  <em className={item.rankStd < 1 ? "stable" : ""}>
                    {(item.top3Rate * 100).toFixed(0)}%
                  </em>
                </div>
              ))}
              <p>百分比表示在权重和公平参数扰动后仍进入前三方案的频率；绿色表示排名标准差小于 1。</p>
            </section>
          )}

          <section className="portfolio-summary">
            <span>{mode === "housing" ? "组合方案账本" : "赛事成本效益"}</span>
            {mode === "housing" ? (
              <div>
                <b>{housingOptimization.selected.length} 项设施</b>
                <small>成本 {housingOptimization.evaluation.lifecycleCost.toFixed(2)} 亿</small>
                <small>CVaR {housingOptimization.evaluation.robustnessPenalty.toFixed(2)} 亿</small>
              </div>
            ) : (
              <div>
                <b>{cupOptimization.selected.length} 项干预</b>
                <small>成本 {cupOptimization.evaluation.lifecycleCost.toFixed(2)} 亿</small>
                <small>赛后价值 {cupOptimization.evaluation.legacyValue.toFixed(2)} 亿</small>
              </div>
            )}
          </section>

          <div className="recommendation-heading">
            <span>{mode === "housing" ? "组合选址建议" : "动态干预建议"}</span>
            <small>{mode === "housing" ? "贪心 + swap 局部搜索" : "随需求、预算和赛后权重重算"}</small>
          </div>

          <div className="recommendation-list">
            {recommendations.length === 0 && (
              <div className="empty-recommendation">
                当前预算与时点下没有正净效益方案。可提高预算或延长评估期后重新计算。
              </div>
            )}
            {recommendations.map((item) => (
              <article
                className={`recommendation-card ${
                  item.sourceId === (mode === "housing"
                    ? resolvedActiveRecommendationId
                    : resolvedActiveCupInterventionId)
                    ? "map-active"
                    : ""
                }`}
                key={item.rank}
              >
                <div className={`rank ${item.tone}`}>0{item.rank}</div>
                <div className="recommendation-copy">
                  <span className={`recommendation-type ${item.tone}`}>{item.type}</span>
                  <h3>{item.title}</h3>
                  <div className="place">⌖ {item.place}</div>
                  <p>{item.detail}</p>
                  <div className="recommendation-meta">
                    <strong>{item.impact}</strong>
                    <span>{item.scoreLabel ?? "方案稳健度"} {item.score}%</span>
                  </div>
                  {item.sourceId && (mode === "housing" || hasWorldCupSpatialData) && (
                    <button
                      className="map-locate"
                      onClick={() => mode === "housing"
                        ? activateRecommendation(item.sourceId!, true)
                        : activateCupIntervention(item.sourceId!, true)}
                    >
                      <MapPinned size={12} />
                      在地图定位方案 0{item.rank}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <button
            className="run-button"
            onClick={() =>
              showToast(
                mode === "housing"
                  ? `已从 ${analysisScenario.parcels.length} 个${analysisScenario.isImported ? "代理候选网格" : "地块"}生成 ${generatedCandidates.length} 个候选，并完成组合优化`
                  : `已按${matchScenarios[matchScenario].label}重算 ${cupOptimization.candidateCount} 项干预`,
              )
            }
          >
            <span>运行新一轮优化</span>
            <small>{mode === "housing" ? "自动候选生成 · 多社区溢出 · 贪心 + 局部交换" : "动态需求链 · 全生命周期成本 · 赛后闲置 CVaR"}</small>
          </button>
          </>)}
        </aside>
      </section>

      <section className="ai-dock">
        <div className="ai-identity">
          <span className="ai-orb">AI</span>
          <span>
            <strong>规划共创助手</strong>
            <small>理解模型、解释建议、调用选址工具</small>
          </span>
        </div>
        <div className="chat-stream" aria-live="polite">
          {messages.slice(-2).map((message, index) => (
            <div className={`chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
              {message.text}
            </div>
          ))}
        </div>
        <form
          className="chat-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitChat();
          }}
        >
          <div className="prompt-chips">
            <button type="button" onClick={() => submitChat(mode === "housing" ? "预算只有 2 亿元，怎么分配？" : "5 万人场馆为什么只能接待 4000 人？")}>
              {mode === "housing" ? "预算 2 亿怎么分？" : "解释 4,000 人瓶颈"}
            </button>
            <button type="button" onClick={() => submitChat("把公平性权重提高后会怎样？")}>
              对比公平 / 效率
            </button>
            {mode === "housing" && hasHousingData && (
              <button type="button" onClick={() => submitChat(`${activeHousing.name}的房价为什么与模型价值有偏差？`)}>
                解释房价偏差
              </button>
            )}
          </div>
          <div className="chat-input">
            <input
              aria-label="向规划助手提问"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="例如：为什么先建医院，而不是学校？"
            />
            <button type="submit" aria-label="发送消息">↑</button>
          </div>
        </form>
      </section>

      {panel !== "none" && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setPanel("none")}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={panel === "model" ? "模型说明" : panel === "import" ? "导入真实规划数据" : "手动添加设施"}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setPanel("none")} aria-label="关闭">
              ×
            </button>

            {panel === "import" && (
              <>
                <span className="modal-kicker">DATA CONNECTOR</span>
                <h2>{mode === "housing" ? "建立可审计的真实数据链" : "建立世界杯赛事空间数据链"}</h2>
                <p className="modal-lead">
                  {mode === "housing"
                    ? "地图 POI 负责发现位置，OSRM 负责行车时间；企业清单校准岗位和行业，成交记录只用于评分后的享乐价格审计，法定控规面替换代理候选网格。每一层都保留来源等级，不把代理值冒充法定或统计数据。"
                    : "腾讯地图检索场馆与赛事设施，天地图补充并交叉确认公共设施，OSRM 计算场馆到酒店、交通、医疗、餐饮和公卫节点的行车时间。容量缺少官方数据时会明确标记为代理值。"}
                </p>
                <form onSubmit={handleTencentImport}>
                  <label>
                    分析区域
                    <input
                      value={importRegion}
                      onChange={(event) => setImportRegion(event.target.value)}
                      placeholder="例如：北京市海淀区"
                      autoFocus
                    />
                  </label>
                  <label>
                    临时覆盖 Key <span>（可选，不会保存）</span>
                    <input
                      value={importKey}
                      onChange={(event) => setImportKey(event.target.value)}
                      placeholder="留空则使用已安全配置的服务端 Key"
                      type="password"
                    />
                  </label>
                  <div className="import-pipeline">
                    <span><b>01</b> {mode === "housing" ? "POI 分类检索" : "场馆与设施识别"}</span>
                    <i>→</i>
                    <span><b>02</b> {mode === "housing" ? "多方式路网矩阵" : "腾讯 × 天地图融合"}</span>
                    <i>→</i>
                    <span><b>03</b> {mode === "housing" ? "容量品质校准" : "OSRM 承载力折损"}</span>
                  </div>
                  <button className="modal-submit" disabled={importStatus === "loading"}>
                    {importStatus === "loading"
                      ? "正在建立空间索引…"
                      : mode === "housing"
                        ? "导入腾讯 POI 并建立 OSRM 矩阵"
                        : "导入场馆与赛事设施并计算承载力"}
                  </button>
                </form>
                {mode === "worldcup" && (
                  <section className="qcc-connector" aria-label="世界杯空间数据范围">
                    <div>
                      <span>EVENT SPATIAL CHAIN</span>
                      <b>共享住房版地图与路网能力</b>
                      <p>检索体育场、酒店、地铁、铁路、公交枢纽、机场、停车场、医院、急救、餐饮、商业和公共厕所；同一设施可按实际可达性服务多座场馆。</p>
                    </div>
                  </section>
                )}
                {mode === "housing" && <>
                <section className="qcc-connector" aria-label="企查查就业校准">
                  <div>
                    <span>QCC COMPANY MCP</span>
                    <b>校准行业与岗位人数</b>
                    <p>保留腾讯地图坐标作为工作地点代理，只对唯一精确主体读取企查查行业与最新年报。人数未披露时，参保人数仅作为下界代理；同名多候选不会自动选中。</p>
                  </div>
                  <label>
                    临时企查查 Token <span>（服务端已配置可留空，不会保存）</span>
                    <input
                      value={qccAuthorization}
                      onChange={(event) => setQccAuthorization(event.target.value)}
                      placeholder="Bearer …"
                      type="password"
                    />
                  </label>
                  <button
                    className="modal-secondary"
                    type="button"
                    disabled={!analysisScenario.facilities.some((facility) => facility.type === "employment")}
                    onClick={() => void handleQccEmploymentCalibration()}
                  >
                    用企查查校准当前就业点（最多 6 家）
                  </button>
                </section>
                <div className="file-connectors">
                  <article>
                    <span>EMPLOYMENT CSV</span>
                    <b>企业与就业结构</b>
                    <p>列：name、lat、lng、industry、employees，可选 coordinate_system=wgs84/gcj02（默认 WGS‑84）。可导入企业平台授权导出或自有清单；缺员工数时明确标记代理。</p>
                    <label className="file-button">
                      选择企业 CSV
                      <input type="file" accept=".csv,text/csv" onChange={handleEnterpriseCsv} />
                    </label>
                    <a className="template-link" href="/templates/enterprise-template.csv" download>下载字段模板</a>
                  </article>
                  <article>
                    <span>TRANSACTION CSV</span>
                    <b>真实成交享乐模型</b>
                    <p>列：zone_id/小区、unit_price、area、building_age、floor_ratio、green_ratio、distance_cbd_km、transaction_month；至少 30 条并覆盖 3 个小区。</p>
                    <label className="file-button">
                      选择成交 CSV
                      <input type="file" accept=".csv,text/csv" onChange={handleTransactionCsv} />
                    </label>
                    <a className="template-link" href="/templates/transaction-template.csv" download>下载 30 条示例模板（非实证）</a>
                  </article>
                  <article>
                    <span>LEGAL GEOJSON</span>
                    <b>法定控规候选地块</b>
                    <p>面要含 legal_status、approval_ref、area_ha、land_price_10k_per_mu、zoning_allowed，可选 coordinate_system；没有批准文号的草案不会进入优化器。</p>
                    <label className="file-button">
                      选择控规 GeoJSON
                      <input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={handleLegalParcelGeoJson} />
                    </label>
                    <a className="template-link" href="/templates/legal-parcels-template.geojson" download>下载字段模板（需填批准文号）</a>
                  </article>
                </div>
                </>}
                <div className="source-catalog">
                  <b>可接入的权威来源</b>
                  <a href="https://project-osrm.org/docs/v26.4.0/api/#table-service" target="_blank" rel="noreferrer">OSRM 路网矩阵文档 ↗</a>
                  <a href="https://giscience.github.io/openrouteservice/api-reference/endpoints/matrix/" target="_blank" rel="noreferrer">OpenRouteService Matrix 文档 ↗</a>
                  <a href="https://lbs.tianditu.gov.cn/api/js4.0/pages-class/MapOptions.html" target="_blank" rel="noreferrer">天地图 JavaScript API 文档 ↗</a>
                  <a href="https://www.gsxt.gov.cn/" target="_blank" rel="noreferrer">国家企业信用信息公示系统 ↗</a>
                  <a href="https://data.sh.gov.cn/view/" target="_blank" rel="noreferrer">上海市公共数据开放平台 ↗</a>
                  <a href="https://zygh.xm.gov.cn/zwgk/zdxxgk/ghcg/" target="_blank" rel="noreferrer">厦门市自然资源和规划局规划成果 ↗</a>
                </div>
                {importErrorMessage && <div className="form-error">{importErrorMessage}</div>}
                {pipelineStatus && <div className="pipeline-status">{pipelineStatus}</div>}
                {mode === "housing" && <section className="route-matrix-control" aria-label="岗位可达出行方式">
                  <div>
                    <b>岗位可达路网方式</b>
                    <span>驾车默认走 OSRM；步行/骑行按需消耗 ORS 矩阵额度。结果仅替换岗位可达阻抗，不把不同方式混成一个分数。</span>
                    {analysisScenario.routeMatrix && (
                      <small>当前生效：{routeProfileLabel(analysisScenario.routeMatrix.profile)} · {analysisScenario.routeMatrix.destinationCount} 个目的地 · {analysisScenario.routeMatrix.source}</small>
                    )}
                  </div>
                  <select
                    value={routeProfile}
                    onChange={(event) => setRouteProfile(event.target.value as RouteMatrixProfile)}
                  >
                    {routeProfileOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} · {option.quotaNote}
                      </option>
                    ))}
                  </select>
                  <button className="modal-secondary" type="button" onClick={() => void refreshRouteMatrix()}>
                    按所选方式刷新路网矩阵
                  </button>
                </section>}
                {mode === "housing" && hasHousingData && (
                  <button className="modal-secondary" type="button" onClick={clearAnalysisScenario}>
                    清空当前分析并选择新区
                  </button>
                )}
              </>
            )}

            {panel === "manual" && (
              <>
                <span className="modal-kicker">SCENARIO BUILDER</span>
                <h2>手动构建设施情景</h2>
                <p className="modal-lead">
                  用于规划草案、尚未建成设施或没有地图数据的区域。添加后会立即触发价值与公平性复算。
                </p>
                <form onSubmit={handleManualAdd}>
                  <label>
                    设施类型
                    <select value={manualType} onChange={(event) => setManualType(event.target.value)}>
                      {(mode === "housing"
                        ? ["社区卫生服务中心", "小学", "托育中心", "公交枢纽", "社区公园", "新增居住区"]
                        : ["赛事旅馆", "P+R 接驳站", "球迷广场", "急救站", "公共卫生间", "新建球场"]
                      ).map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label>
                    设施名称
                    <input value={manualName} onChange={(event) => setManualName(event.target.value)} placeholder="例如：东港社区健康中心" />
                  </label>
                  <label>
                    {manualType === "新增居住区" ? "规划人口（人）" : "设计容量"}
                    <input value={manualCapacity} onChange={(event) => setManualCapacity(event.target.value)} type="number" min="1" />
                  </label>
                  <label>
                    纬度
                    <input value={manualLat} onChange={(event) => setManualLat(event.target.value)} type="number" step="0.000001" min="-90" max="90" />
                  </label>
                  <label>
                    经度
                    <input value={manualLng} onChange={(event) => setManualLng(event.target.value)} type="number" step="0.000001" min="-180" max="180" />
                  </label>
                  {mode === "housing" && manualType !== "新增居住区" && (
                    <>
                      <label>
                        品质系数（0–1）
                        <input value={manualQuality} onChange={(event) => setManualQuality(event.target.value)} type="number" step="0.05" min="0.1" max="1" />
                      </label>
                      <label>
                        投用年份
                        <input value={manualOpeningYear} onChange={(event) => setManualOpeningYear(event.target.value)} type="number" min={BASE_YEAR} max="2100" />
                      </label>
                    </>
                  )}
                  <small>容量会进入供需竞争或赛事承载链；经纬度用于距离计算，不再只是地图装饰标记。</small>
                  <button className="modal-submit">加入空间沙盘</button>
                </form>
              </>
            )}

            {panel === "model" && (
              <>
                <span className="modal-kicker">EXPLAINABLE MODEL</span>
                <h2>{mode === "housing" ? "居住价值与去中心化模型" : "场馆价值与承载力模型"}</h2>
                {mode === "housing" ? (
                  <div className="model-explainer">
                    <div className="formula">
                      R<sub>jkt</sub> = C<sub>jk</sub>Q<sub>jk</sub> / Σ<sub>l</sub>D<sub>lkt</sub>f(d<sub>lj</sub>)；A<sub>ikt</sub> = Sigmoid[Σ<sub>j</sub>R<sub>jkt</sub>f(d<sub>ij</sub>)]
                      <br />
                      U<sub>it</sub> = 0.778L + 0.222M + I
                      <br />
                      V<sub>it</sub> = [0.90U<sub>it</sub> + 0.10C<sub>region,t</sub>] × m(R<sub>i</sub>)
                    </div>
                    <div className="model-grid">
                      <article><b>容量竞争 A</b><p>设施容量先在服务圈内按人口需求与距离分摊，再回流到各社区；同一家医院或学校不再被多个社区重复完整使用。医疗等使用高斯衰减，公交使用指数衰减，商业等使用重力衰减。</p></article>
                      <article><b>非线性交互 I</b><p>医疗×公交、教育×绿地、岗位×轨道形成互补奖励；养老服务与低安全、绿地与污染暴露形成冲突惩罚。</p></article>
                      <article><b>人口自适应权重</b><p>老年、儿童与劳动年龄人口按偏好向量混合，并在各空间层内重新归一化。因此同一设施对不同社区的价值不同。</p></article>
                      <article><b>岗位可达与多样性</b><p>岗位可达使用当前所选路网方式的 30 分钟阻抗：驾车走 OSRM，步行/骑行走 ORS；企业 CSV 的员工数替换 POI 代理岗位。就业多样性按可达岗位的行业 Shannon 熵、HHI 反向值和行业覆盖面合成，避免“岗位很多但行业单一”获得同等高分。</p></article>
                      <article><b>时间与风险 m(R)</b><p>人口按社区增长率预测；只有数据明确给出投用年/退役年的设施才会进入或退出。地质、洪涝、污染、工业和噪声按最大暴露与加权暴露合成，乘数限制在 0.55–1.0，避免单一风险抹去全部服务价值。</p></article>
                      <article><b>场地冲突红线</b><p>候选点先与机场、港口、化工园、垃圾/污水设施和铁路货运站计算距离。养老、学校在机场 8km 内、港口 5.5km 内直接淘汰；医疗、社区文化和公园采用 6km / 5km 红线。该圆形红线是缺少机场噪声等值线、港区边界时的保守代理，正式规划仍须替换为法定图层。</p></article>
                      <article><b>六类交通构成</b><p>综合交通由步行20%、自行车12%、公交/BRT 28%、地铁25%、道路驾车10%、轮渡/城际5%组成。不同方式使用不同服务距离、容量基准与衰减函数。</p></article>
                      <article><b>公平口径</b><p>F = 100 × (1 − 人口加权Gini)。优化同时奖励公平指数改善、低于 45 分社区的缺口闭合和低分社区的边际福利，不把“大家同样低”误判为优质均衡。</p></article>
                    </div>
                    <div className="regional-rule">
                      <b>区域层为什么保留</b>
                      <p>在同一分析区内部，它是所有小区共享的背景常数，不负责区分小区，也不进入区内公平排序。它只在跨城市比较、新城选址，或模拟区域政策与气候变化时产生辨别力。</p>
                    </div>
                    <div className="regional-rule">
                      <b>年份从哪里知道新建和拆除</b>
                      <p>腾讯 POI 只说明“当前能检索到”，系统默认其在 2026 年存在，但不会据此猜测未来。openingYear / closingYear 必须来自批复项目库、建设许可、国土空间规划、城市更新/征收清单或人工录入；字段缺失表示“未知并暂按持续存在”，不等于永不拆除。优化器建议的新设施只属于方案，不会混入基准设施。</p>
                    </div>
                    <div className="price-rule">
                      <b>房价不进入 V</b>
                      <p>模型评分完成后才运行成交审计。导入 CSV 时，对数成交单价使用岭回归并控制面积、房龄、容积率、绿化率、距 CBD、成交月份和服务价值；没有真实成交时才保留同城标准化演示口径。残差是统计关联，不自动解释为投机或低估。</p>
                    </div>
                    <h3 className="algorithm-title">选址建议如何生成</h3>
                    <div className="siting-steps">
                      <span><b>01</b>自动生成<small>地块 × 允许设施类型</small></span>
                      <i>→</i>
                      <span><b>02</b>空间过滤<small>用地、机场/港口红线、风险和服务半径</small></span>
                      <i>→</i>
                      <span><b>03</b>组合贪心<small>每次重算所有社区的边际效益</small></span>
                      <i>→</i>
                      <span><b>04</b>swap 精修<small>替换设施，跳出贪心局部解</small></span>
                    </div>
                    <div className="objective">
                      max J = (1−λ) · 效率收益PV + λ · 公平福利PV − 全生命周期成本 − 风险CVaR
                    </div>
                    <p className="algorithm-note">四项目标均转换为亿元现值。当前由 {analysisScenario.parcels.length} 个{analysisScenario.parcelDataStatus === "legal" ? "带批准文号的法定控规地块" : analysisScenario.parcelDataStatus === "proxy" ? "待用地核验的代理网格" : "演示地块"}经过 {analysisScenario.constraints.length} 个冲突源筛查后生成 {generatedCandidates.length} 个候选。硬红线内候选直接剔除；约束图层缺失时只标记为“初筛稳健度”，不再冒充统计置信度。</p>

                    <h3 className="algorithm-title">自适应求解器：问题不同，算法不同</h3>
                    <div className="solver-matrix">
                      <article>
                        <span>ACTIVE</span>
                        <b>贪心 + swap 局部搜索</b>
                        <p>本原型已实际运行：支持最多四项设施组合、跨社区溢出、同地块互斥和预算硬约束。</p>
                      </article>
                      <article>
                        <span>MILP</span>
                        <b>混合整数规划</b>
                        <p>候选地块明确、约束严格、规模中等时使用；能给出最优性差距，适合学校和基层医疗。</p>
                      </article>
                      <article>
                        <span>PSO</span>
                        <b>粒子群优化</b>
                        <p>位置或容量近似连续时先搜索坐标，再吸附到合法地块；适合大型医院、球场和枢纽粗选。</p>
                      </article>
                      <article>
                        <span>NSGA-II + SA</span>
                        <b>遗传算法 + 模拟退火</b>
                        <p>多设施、多目标和城市级问题：遗传算法探索帕累托前沿，退火负责移动、交换和容量微调。</p>
                      </article>
                    </div>
                    <div className="hybrid-route">
                      <b>当前计算链</b>
                      <span>空间候选生成</span><i>→</i>
                      <span>贪心热启动</span><i>→</i>
                      <span>地块 swap</span><i>→</i>
                      <span>{analysisScenario.isImported ? "18" : "48"} 次参数扰动</span><i>→</i>
                      <span>稳定性报告</span>
                    </div>

                    <h3 className="algorithm-title">正式参数标定路线</h3>
                    <div className="weight-sources">
                      <article><strong>35%</strong><span>建议：规范与专家先验</span><small>国标服务半径、强制条文、AHP / Delphi</small></article>
                      <article><strong>30%</strong><span>建议：居民偏好</span><small>分年龄家庭调查、最佳—最差法与离散选择</small></article>
                      <article><strong>20%</strong><span>建议：真实使用行为</span><small>就医、入学、通勤和设施访问频率</small></article>
                      <article><strong>15%</strong><span>建议：客观信息量</span><small>熵权 / CRITIC，避免高度重复指标重复计权</small></article>
                    </div>
                    <div className="weight-disclosure">
                      <b>参数披露</b>
                      <p>现有13、11、10等基础分仍是演示先验，再由社区人口结构动态修正；35/30/20/15 是下一阶段的数据融合计划，并非已经完成的训练结果。页面实际运行权重±20%、λ±20%的48次扰动；Sigmoid阈值、衰减尺度和风险映射仍需真实出行与灾害数据标定。</p>
                    </div>
                  </div>
                ) : (
                  <div className="model-explainer">
                    <div className="formula">
                      D<sub>k</sub> = 到场人数 × 客群结构 × 并发系数 × 服务需求率
                      <br />
                      C<sub>effective</sub> = 到场人数 × min<sub>k</sub>(Supply<sub>k</sub> / D<sub>k</sub>)
                    </div>
                    <div className="model-grid">
                      <article><b>需求端已接入</b><p>小组赛、淘汰赛、决赛具有不同上座率；国际与外地观众决定住宿比例，双场并发会竞争交通、住宿和公卫资源。</p></article>
                      <article><b>供需链动态重算</b><p>交通、住宿、餐饮、医疗、公卫分别计算 supply / demand，最小比率形成当前有效承载和动态瓶颈。</p></article>
                      <article><b>预算驱动组合</b><p>候选干预按边际净效益逐项加入，预算是硬约束；改变场馆、赛事情景、预算或赛后权重会立即生成新推荐。</p></article>
                      <article><b>白象风险量化</b><p>赛事收益、15年赛后公共收益、建设成本与闲置损失CVaR统一为亿元现值，优先可转公寓、公共交通和社区设施的方案。</p></article>
                    </div>
                    <div className="objective">max J = (1−λ) · 赛事增量收益PV + λ · 赛后利用价值PV − 生命周期成本 − 闲置CVaR</div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}
