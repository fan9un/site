"use client";

import {
  FormEvent,
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
} from "react";

type Mode = "housing" | "worldcup";
type MetricMap = Record<string, number>;
type HousingRing = "inner" | "middle" | "outer";

type HousingZone = {
  id: string;
  name: string;
  subtitle: string;
  population: number;
  price: number;
  priceReason: string;
  risk: number;
  metrics: MetricMap;
};

type Stadium = {
  id: string;
  name: string;
  city: string;
  capacity: number;
  metrics: MetricMap;
  limits: {
    交通: number;
    住宿: number;
    餐饮: number;
    医疗: number;
    公卫: number;
  };
};

type Recommendation = {
  rank: number;
  type: string;
  title: string;
  place: string;
  impact: string;
  detail: string;
  score: number;
  tone: "lime" | "coral" | "blue";
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

const ringNames: Record<HousingRing, string> = {
  inner: "内圈 · 日常服务",
  middle: "中圈 · 城市结构",
  outer: "外圈 · 宏观韧性",
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
    population: 8.6,
    price: 4.2,
    priceReason: "次新房供给偏少、开发商品牌和学区预期形成市场溢价，房价高于公共服务模型所能解释的部分。",
    risk: 2,
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
    population: 6.2,
    price: 3.1,
    priceReason: "滨水景观带来一定价格支撑，但养老医疗与跨区通勤较弱；景观溢价掩盖了日常服务缺口。",
    risk: 4,
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
    population: 7.4,
    price: 2.7,
    priceReason: "岗位与规划利好尚未充分资本化；传统工业印象、绿地短缺和风险感知压低成交价，因此模型价值高于市场价格。",
    risk: 7,
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
    population: 5.8,
    price: 3.7,
    priceReason: "教育、公园和基层服务共同支撑房价，市场价格与模型价值基本一致，偏差处于可接受范围。",
    risk: 1,
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
    population: 9.1,
    price: 3.4,
    priceReason: "商业、餐饮与公交成熟支撑价格，但老旧住房品质和公园托育短板抵消了区位优势，房价与模型值接近。",
    risk: 5,
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

const sitingCandidates = [
  { zoneId: "donggang", factor: "medical", facility: "社区卫生服务中心", parcel: "东南生活圈 E-12", cost: 0.82, boost: 38, robustness: 95 },
  { zoneId: "donggang", factor: "green", facility: "带状社区公园", parcel: "工业支路更新地块 G-04", cost: 0.64, boost: 34, robustness: 88 },
  { zoneId: "donggang", factor: "education", facility: "九年一贯制学校", parcel: "轨道站西北地块 S-09", cost: 1.76, boost: 36, robustness: 84 },
  { zoneId: "hewan", factor: "care", facility: "养老托育复合站", parcel: "滨河路口 C-03", cost: 0.46, boost: 42, robustness: 92 },
  { zoneId: "hewan", factor: "regionalTransit", facility: "社区接驳枢纽", parcel: "河湾大道 T-08", cost: 0.71, boost: 31, robustness: 86 },
  { zoneId: "xicheng", factor: "green", facility: "口袋公园组团", parcel: "旧厂院更新地块 G-11", cost: 0.38, boost: 29, robustness: 91 },
  { zoneId: "xicheng", factor: "care", facility: "嵌入式托育中心", parcel: "西城市场北侧 C-06", cost: 0.29, boost: 35, robustness: 90 },
  { zoneId: "beiyuan", factor: "culture", facility: "社区文化中心", parcel: "北园中轴 P-02", cost: 0.55, boost: 26, robustness: 82 },
  { zoneId: "nanhu", factor: "employment", facility: "社区共享办公站", parcel: "南湖轨道上盖 J-05", cost: 0.34, boost: 24, robustness: 79 },
] as const;

function weightedScore(metrics: MetricMap, factors: readonly { key: string; weight: number }[]) {
  const total = factors.reduce((sum, factor) => sum + factor.weight, 0);
  return factors.reduce(
    (sum, factor) => sum + (metrics[factor.key] ?? 0) * factor.weight,
    0,
  ) / total;
}

function housingValue(metrics: MetricMap, risk: number) {
  const ringScores = {
    inner: weightedScore(
      metrics,
      housingFactors.filter((factor) => factor.ring === "inner"),
    ),
    middle: weightedScore(
      metrics,
      housingFactors.filter((factor) => factor.ring === "middle"),
    ),
    outer: weightedScore(
      metrics,
      housingFactors.filter((factor) => factor.ring === "outer"),
    ),
  };
  const score =
    ringScores.inner * housingRingMix.inner +
    ringScores.middle * housingRingMix.middle +
    ringScores.outer * housingRingMix.outer -
    risk;
  return { score: Math.max(0, score), ringScores };
}

function stdDev(values: number[]) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function fairnessIndex(values: number[]) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const coefficient = stdDev(values) / mean;
  return Math.max(0, 100 - coefficient * 310);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(Math.round(value));
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("housing");
  const [activeHousingId, setActiveHousingId] = useState("donggang");
  const [activeStadiumId, setActiveStadiumId] = useState("linhai");
  const [fairnessWeight, setFairnessWeight] = useState(68);
  const [budget, setBudget] = useState(3.2);
  const [factorView, setFactorView] = useState<"core" | "all">("all");
  const [panel, setPanel] = useState<"none" | "import" | "manual" | "model">("none");
  const [importKey, setImportKey] = useState("");
  const [importRegion, setImportRegion] = useState("北京市朝阳区");
  const [importStatus, setImportStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [customFacilities, setCustomFacilities] = useState<string[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualType, setManualType] = useState("社区卫生服务中心");
  const [manualCapacity, setManualCapacity] = useState("1200");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "我已读取当前空间评分。东港里是住房模式下的优先补短板区域；若切换世界杯模式，我会改用场馆承载力约束。",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [toast, setToast] = useState("");

  const housingScores = useMemo(() => {
    const prices = housingZones.map((zone) => zone.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    return housingZones.map((zone) => {
      const model = housingValue(zone.metrics, zone.risk);
      // 房价严格位于模型之外：仅在价值评分完成后转换为可比指数。
      const priceIndex =
        45 + ((zone.price - minPrice) / (maxPrice - minPrice)) * 45;
      const residual = priceIndex - model.score;
      return {
        ...zone,
        service: model.score,
        score: model.score,
        ringScores: model.ringScores,
        priceIndex,
        residual,
      };
    });
  }, []);

  const meanHousingScore =
    housingScores.reduce((sum, zone) => sum + zone.score, 0) / housingScores.length;
  const cv = stdDev(housingScores.map((zone) => zone.score)) / meanHousingScore;
  const fairness = fairnessIndex(housingScores.map((zone) => zone.score));

  const activeHousing =
    housingScores.find((zone) => zone.id === activeHousingId) ?? housingScores[0];
  const activeStadium =
    stadiums.find((stadium) => stadium.id === activeStadiumId) ?? stadiums[0];
  const stadiumScore = weightedScore(activeStadium.metrics, cupFactors);
  const effectiveCapacity = Math.min(...Object.values(activeStadium.limits));
  const capacityRate = (effectiveCapacity / activeStadium.capacity) * 100;

  const housingRecommendations = useMemo<Recommendation[]>(() => {
    const currentScores = housingScores.map((zone) => zone.score);
    const currentFairness = fairnessIndex(currentScores);
    const scored = sitingCandidates.map((candidate) => {
      const zoneIndex = housingScores.findIndex(
        (zone) => zone.id === candidate.zoneId,
      );
      const zone = housingScores[zoneIndex];
      const factor = housingFactors.find(
        (item) => item.key === candidate.factor,
      )!;
      const nextMetrics = {
        ...zone.metrics,
        [candidate.factor]: Math.min(
          100,
          zone.metrics[candidate.factor] + candidate.boost,
        ),
      };
      const nextValue = housingValue(nextMetrics, zone.risk).score;
      const valueGain = nextValue - zone.score;
      const nextScores = [...currentScores];
      nextScores[zoneIndex] = nextValue;
      const fairnessGain = fairnessIndex(nextScores) - currentFairness;
      const populationBenefit = valueGain * zone.population;
      const equityShare = fairnessWeight / 100;
      const budgetPenalty = Math.max(0, candidate.cost - budget) * 8;
      const objective =
        populationBenefit * (1 - equityShare) +
        fairnessGain * 18 * equityShare +
        candidate.robustness * 0.08 -
        candidate.cost * 2.5 -
        budgetPenalty;
      return {
        ...candidate,
        zone,
        factor,
        valueGain,
        fairnessGain,
        populationBenefit,
        objective,
      };
    });

    return scored
      .sort((a, b) => b.objective - a.objective)
      .slice(0, 3)
      .map((candidate, index) => ({
        rank: index + 1,
        type: `${ringNames[candidate.factor.ring]} · ${candidate.factor.label}`,
        title: `新建${candidate.facility}`,
        place: `${candidate.zone.name} · ${candidate.parcel}`,
        impact: `价值 +${candidate.valueGain.toFixed(1)}`,
        detail: `硬约束通过；公平指数 +${candidate.fairnessGain.toFixed(1)}，人口收益 ${candidate.populationBenefit.toFixed(1)}，成本 ${candidate.cost.toFixed(2)} 亿元。`,
        score: candidate.robustness,
        tone: (["lime", "coral", "blue"] as const)[index],
      }));
  }, [budget, fairnessWeight, housingScores]);

  const cupRecommendations: Recommendation[] = [
    {
      rank: 1,
      type: "住宿集群",
      title: "建设赛事旅馆组团",
      place: "临港站东侧 · 3.2km",
      impact: "新增 8,600 床",
      detail: "与轨道接驳共址，赛后转为青年公寓与会展住宿，避免单一赛事资产闲置。",
      score: 98,
      tone: "lime",
    },
    {
      rank: 2,
      type: "交通疏散",
      title: "设置 P+R 接驳枢纽",
      place: "滨海大道 · 城市外环",
      impact: "疏散 +16,000 人/h",
      detail: "形成三向离场通道，预计将 90 分钟疏散覆盖率由 36% 提升至 74%。",
      score: 93,
      tone: "blue",
    },
    {
      rank: 3,
      type: "场馆备选",
      title: "新球场候选地 B-07",
      place: "龙城新区 · 综合交通廊道",
      impact: "适配 45,000 座",
      detail: "周边既有设施可承载 38,200 人；仅需补充公卫与短时住宿，综合成本更低。",
      score: 86,
      tone: "coral",
    },
  ];

  const factors = mode === "housing" ? housingFactors : cupFactors;
  const recommendations =
    mode === "housing" ? housingRecommendations : cupRecommendations;
  const activeMetrics =
    mode === "housing" ? activeHousing.metrics : activeStadium.metrics;
  const markers = mode === "housing" ? housingMarkers : cupMarkers;

  useEffect(() => {
    setFactorView(mode === "housing" ? "all" : "core");
    setToast("");
  }, [mode]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function handleTencentImport(event: FormEvent) {
    event.preventDefault();
    setImportStatus("loading");
    if (!importKey.trim()) {
      window.setTimeout(() => {
        setImportStatus("done");
        showToast("已导入 126 个演示 POI，并完成距离矩阵计算");
      }, 850);
      return;
    }
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
      const result = (await response.json()) as { count?: number };
      setImportStatus("done");
      showToast(`已从腾讯地图导入 ${result.count ?? 0} 个 POI`);
    } catch {
      setImportStatus("error");
    }
  }

  function handleManualAdd(event: FormEvent) {
    event.preventDefault();
    const name = manualName.trim() || manualType;
    setCustomFacilities((items) => [
      `${name} · 容量 ${formatNumber(Number(manualCapacity) || 0)}`,
      ...items,
    ]);
    setManualName("");
    setPanel("none");
    showToast(`${name}已加入沙盘，模型评分已重新计算`);
  }

  function submitChat(text?: string) {
    const question = (text ?? chatInput).trim();
    if (!question) return;
    const asksAboutPrice = /房价|价格|偏差|高估|低估/.test(question);
    const context =
      mode === "housing"
        ? asksAboutPrice
          ? `${activeHousing.name}的模型价值为 ${activeHousing.score.toFixed(1)}，房价指数为 ${activeHousing.priceIndex.toFixed(1)}，残差为 ${activeHousing.residual > 0 ? "+" : ""}${activeHousing.residual.toFixed(1)}。房价没有参与评分；偏差解释是：${activeHousing.priceReason}`
          : `在当前 ${budget.toFixed(1)} 亿元预算和 ${fairnessWeight}% 公平性偏好下，建议先在${housingRecommendations[0].place}建设${housingRecommendations[0].title}。这是对全部候选点逐点重算价值、公平性和成本后的最高目标函数解。`
        : `${activeStadium.name}的名义容量为 ${formatNumber(activeStadium.capacity)} 人，但当前瓶颈是住宿，仅能承载 ${formatNumber(effectiveCapacity)} 人。应先建设临港站东侧旅馆组团，再配置 P+R 接驳，完成后再复算医疗与公卫瓶颈。`;
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
            onClick={() => setMode("housing")}
          >
            <span>城市住房</span>
            <small>15 分钟生活圈</small>
          </button>
          <button
            className={mode === "worldcup" ? "active" : ""}
            onClick={() => setMode("worldcup")}
          >
            <span>世界杯 2038</span>
            <small>场馆承载力</small>
          </button>
        </div>

        <div className="top-actions">
          <button className="connection-pill" onClick={() => setPanel("import")}>
            <span className={importStatus === "done" ? "status-dot live" : "status-dot"} />
            {importStatus === "done" ? "腾讯地图已连接" : "演示数据"}
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
            <span className="version">MODEL 1.0</span>
          </div>

          <div className="control-group">
            <label htmlFor="fairness">
              <span>公平性偏好</span>
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
              <span>效率优先</span>
              <span>均衡优先</span>
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

          <div className="factor-heading">
            <span>评估变量</span>
            <button onClick={() => setFactorView(factorView === "core" ? "all" : "core")}>
              {factorView === "core" ? "展开 27 项" : "收起"}
            </button>
          </div>

          <div className="factor-list">
            {factors.slice(0, factorView === "core" ? 9 : factors.length).map((factor) => {
              const score = activeMetrics[factor.key] ?? 0;
              return (
                <div className="factor-row" key={factor.key}>
                  <span className="factor-icon">{factor.short}</span>
                  <span className="factor-copy">
                    <span>
                      {factor.label}
                      <small>
                        {"ring" in factor
                          ? `${factor.ring === "inner" ? "内" : factor.ring === "middle" ? "中" : "外"} · ${factor.radius}`
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
          </div>

          {factorView === "all" && mode === "housing" && (
            <div className="extended-factors">
              <span>三层权重封顶</span>
              <p>内圈生活服务 70% · 中圈城市结构 20% · 外圈宏观韧性 10%；洪涝、污染和地质危险另做硬约束。</p>
            </div>
          )}

          <button className="model-link" onClick={() => setPanel("model")}>
            <span>ƒ</span>
            <span>
              查看模型与公式
              <small>可解释评分 · 硬约束优先</small>
            </span>
            <b>→</b>
          </button>
        </aside>

        <section className="map-stage">
          <div className="map-toolbar">
            <div>
              <span className="eyebrow">
                {mode === "housing" ? "北京 · 朝阳模拟片区" : "中国 · 东部候选赛区"}
              </span>
              <h1>
                {mode === "housing" ? "居住价值公平性沙盘" : "赛事设施承载力沙盘"}
              </h1>
            </div>
            <div className="map-actions">
              <button onClick={() => showToast("已聚焦全部分析对象")}>⌖ 全域</button>
              <button onClick={() => setPanel("import")}>⇩ 导入数据</button>
              <button onClick={() => showToast("底图已切换：规划用地")}>▱ 图层</button>
            </div>
          </div>

          <div className={`map-canvas ${mode}`}>
            <div className="map-grid" />
            <div className="water-shape" />
            <div className="road road-one" />
            <div className="road road-two" />
            <div className="road road-three" />

            {mode === "housing" ? (
              <>
                <button
                  className={`zone zone-a ${activeHousingId === "beiyuan" ? "active" : ""}`}
                  onClick={() => setActiveHousingId("beiyuan")}
                  aria-label="选择北园新城"
                >
                  <span>北园新城</span>
                </button>
                <button
                  className={`zone zone-b ${activeHousingId === "hewan" ? "active" : ""}`}
                  onClick={() => setActiveHousingId("hewan")}
                  aria-label="选择河湾社区"
                >
                  <span>河湾社区</span>
                </button>
                <button
                  className={`zone zone-c ${activeHousingId === "donggang" ? "active" : ""}`}
                  onClick={() => setActiveHousingId("donggang")}
                  aria-label="选择东港里"
                >
                  <span>东港里</span>
                </button>
                <button
                  className={`zone zone-d ${activeHousingId === "nanhu" ? "active" : ""}`}
                  onClick={() => setActiveHousingId("nanhu")}
                  aria-label="选择南湖家园"
                >
                  <span>南湖家园</span>
                </button>
                <button
                  className={`zone zone-e ${activeHousingId === "xicheng" ? "active" : ""}`}
                  onClick={() => setActiveHousingId("xicheng")}
                  aria-label="选择西城旧里"
                >
                  <span>西城旧里</span>
                </button>
              </>
            ) : (
              <div className="stadium-ring" aria-label="场馆服务范围">
                <span className="ring-label">5km 服务圈</span>
                <button className="stadium-core" onClick={() => setActiveStadiumId("linhai")}>
                  <b>50K</b>
                  <small>临海竞赛中心</small>
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

            {customFacilities.map((facility, index) => (
              <button
                className="map-marker custom"
                key={facility}
                style={
                  {
                    "--marker-x": `${52 + index * 5}%`,
                    "--marker-y": `${52 - index * 4}%`,
                  } as CSSProperties
                }
                onClick={() => showToast(facility)}
              >
                <span>新</span>
                <small>{facility.split(" · ")[0]}</small>
              </button>
            ))}

            <div className="map-legend">
              {mode === "housing" ? (
                <>
                  <span><i className="legend-high" />内圈服务</span>
                  <span><i className="legend-mid" />中圈岗位 / 商业 / 枢纽</span>
                  <span><i className="legend-low" />外圈环境 / 韧性</span>
                  <span><i className="legend-proposed" />建议选址</span>
                </>
              ) : (
                <>
                  <span><i className="legend-high" />高承载</span>
                  <span><i className="legend-mid" />中承载</span>
                  <span><i className="legend-low" />瓶颈</span>
                  <span><i className="legend-proposed" />建议选址</span>
                </>
              )}
            </div>
          </div>

          <div className="score-strip">
            {mode === "housing" ? (
              <>
                <div className="score-main">
                  <span className="score-badge">{Math.round(activeHousing.score)}</span>
                  <span>
                    <strong>{activeHousing.name}</strong>
                    <small>{activeHousing.subtitle}</small>
                  </span>
                </div>
                <div className="score-stat">
                  <span>三层模型价值</span>
                  <strong>{activeHousing.score.toFixed(1)}</strong>
                  <small>
                    内 {activeHousing.ringScores.inner.toFixed(0)} · 中 {activeHousing.ringScores.middle.toFixed(0)} · 外 {activeHousing.ringScores.outer.toFixed(0)}
                  </small>
                </div>
                <div className="score-stat">
                  <span>市场房价 · 仅用于验证</span>
                  <strong>{activeHousing.price.toFixed(1)} 万</strong>
                  <small>
                    价格指数 {activeHousing.priceIndex.toFixed(0)} · 偏差 {activeHousing.residual > 0 ? "+" : ""}{activeHousing.residual.toFixed(1)}
                  </small>
                </div>
                <div className="score-stat warning">
                  <span>最大短板</span>
                  <strong>
                    {
                      [...housingFactors].sort(
                        (a, b) =>
                          (100 - activeHousing.metrics[b.key]) * b.weight -
                          (100 - activeHousing.metrics[a.key]) * a.weight,
                      )[0].label
                    }
                  </strong>
                  <small>缺口 × 权重后进入候选设施生成</small>
                </div>
              </>
            ) : (
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
                  <small>当前瓶颈：住宿床位</small>
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
            <small>刚刚更新</small>
          </div>

          <section className="fairness-card">
            <div className="fairness-top">
              <span>
                <small>{mode === "housing" ? "全域公平指数" : "场馆准备度"}</small>
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
                ? `当前区域变异系数 ${(cv * 100).toFixed(1)}%。增加公平权重后，算法会优先提升低值区，而非继续叠加中心区。`
                : `场馆本体不是瓶颈。${formatNumber(activeStadium.capacity - effectiveCapacity)} 人的设施缺口集中在住宿、交通与医疗链路。`}
            </p>
          </section>

          {mode === "housing" && (
            <section className="price-audit-card">
              <div className="price-audit-head">
                <span>房价事后校验</span>
                <b>不进入评分</b>
              </div>
              <div className="audit-row">
                <span>模型价值</span>
                <i><b style={{ width: `${activeHousing.score}%` }} /></i>
                <strong>{activeHousing.score.toFixed(1)}</strong>
              </div>
              <div className="audit-row market">
                <span>房价指数</span>
                <i><b style={{ width: `${activeHousing.priceIndex}%` }} /></i>
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

          <div className="recommendation-heading">
            <span>选址建议</span>
            <small>按可解释目标函数排序</small>
          </div>

          <div className="recommendation-list">
            {recommendations.map((item) => (
              <article className="recommendation-card" key={item.rank}>
                <div className={`rank ${item.tone}`}>0{item.rank}</div>
                <div className="recommendation-copy">
                  <span className={`recommendation-type ${item.tone}`}>{item.type}</span>
                  <h3>{item.title}</h3>
                  <div className="place">⌖ {item.place}</div>
                  <p>{item.detail}</p>
                  <div className="recommendation-meta">
                    <strong>{item.impact}</strong>
                    <span>置信度 {item.score}%</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <button className="run-button" onClick={() => showToast(`已筛选 ${sitingCandidates.length} 个候选点并完成边际模拟`)}>
            <span>运行新一轮优化</span>
            <small>硬约束过滤 · 边际模拟 · 帕累托排序 · 稳健性校验</small>
          </button>
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
            {mode === "housing" && (
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
            aria-label={panel === "model" ? "模型说明" : panel === "import" ? "导入腾讯地图数据" : "手动添加设施"}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setPanel("none")} aria-label="关闭">
              ×
            </button>

            {panel === "import" && (
              <>
                <span className="modal-kicker">DATA CONNECTOR</span>
                <h2>从腾讯地图建立真实空间样本</h2>
                <p className="modal-lead">
                  输入 WebService Key 后，系统按设施类别检索 POI、计算路网距离并转换为模型变量。没有 Key 也可载入同结构演示数据。
                </p>
                <form onSubmit={handleTencentImport}>
                  <label>
                    分析区域
                    <input value={importRegion} onChange={(event) => setImportRegion(event.target.value)} />
                  </label>
                  <label>
                    腾讯位置服务 Key <span>（可选）</span>
                    <input
                      value={importKey}
                      onChange={(event) => setImportKey(event.target.value)}
                      placeholder="留空则导入朝阳区演示样本"
                      type="password"
                    />
                  </label>
                  <div className="import-pipeline">
                    <span><b>01</b> POI 分类检索</span>
                    <i>→</i>
                    <span><b>02</b> 路网距离矩阵</span>
                    <i>→</i>
                    <span><b>03</b> 容量归一化</span>
                  </div>
                  {importStatus === "error" && (
                    <div className="form-error">连接失败，请检查 Key、域名白名单或配额后重试。</div>
                  )}
                  <button className="modal-submit" disabled={importStatus === "loading"}>
                    {importStatus === "loading"
                      ? "正在建立空间索引…"
                      : importKey
                        ? "连接并导入"
                        : "载入演示数据"}
                  </button>
                </form>
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
                    设计容量
                    <input value={manualCapacity} onChange={(event) => setManualCapacity(event.target.value)} type="number" min="1" />
                  </label>
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
                      V<sub>i</sub> = 0.70 L<sub>i</sub> + 0.20 M<sub>i</sub> + 0.10 O<sub>i</sub> − R<sub>i</sub>
                    </div>
                    <div className="model-grid">
                      <article><b>L · 内圈 70%</b><p>基层医疗、基础教育、公交、养老托育、购物、公园、文化、餐饮与社区安全；使用路网时间衰减、容量供需比和品质系数。</p></article>
                      <article><b>M · 中圈 20%</b><p>大型商场、岗位可达、三甲医院、高校、轨道枢纽、公共服务、物流、场馆与数字设施，反映跨生活圈城市结构。</p></article>
                      <article><b>O · 外圈 10%</b><p>政策与区域增长、空气、生态、工业环境、灾害韧性、人口结构、气候和历史文化；权重低但不再遗漏。</p></article>
                      <article><b>R · 硬约束</b><p>污染地块、洪涝、滑坡、断裂带和危化品距离先过滤；地形、日照与工业影响再作连续修正。</p></article>
                    </div>
                    <div className="price-rule">
                      <b>房价不进入 V</b>
                      <p>模型评分完成后，才将同一市场内房价转为指数 H。残差 e = H − V 只用于验证：大正残差提示学区预期、稀缺性或投机溢价；大负残差提示环境污名、更新滞后或潜力尚未资本化。</p>
                    </div>
                    <h3 className="algorithm-title">选址建议如何生成</h3>
                    <div className="siting-steps">
                      <span><b>01</b>生成候选点<small>可建设地块、路口与存量更新点</small></span>
                      <i>→</i>
                      <span><b>02</b>硬约束过滤<small>用地、灾害、安全距离与预算</small></span>
                      <i>→</i>
                      <span><b>03</b>逐点边际模拟<small>重算可达性、价值与公平指数</small></span>
                      <i>→</i>
                      <span><b>04</b>帕累托排序<small>收益、均衡、成本与稳健性</small></span>
                    </div>
                    <div className="objective">
                      max J(x,f) = (1−λ) · Δ人口加权价值 + λ · Δ公平性 − μ · 全生命周期成本 + ρ · 稳健性
                    </div>
                    <p className="algorithm-note">当前演示会对 {sitingCandidates.length} 个“地块 × 设施类型”组合逐一重算，而不是直接把最低分区域写成推荐答案。</p>
                  </div>
                ) : (
                  <div className="model-explainer">
                    <div className="formula">
                      C<sub>effective</sub> = min(C<sub>场馆</sub>, C<sub>交通</sub>, C<sub>住宿</sub>, C<sub>医疗</sub>, C<sub>公卫</sub>)
                    </div>
                    <div className="model-grid">
                      <article><b>容量链</b><p>赛事接待能力由最弱环节决定。5 万座球场附近只有 4,000 床位，当前有效承载即为 4,000 人。</p></article>
                      <article><b>峰值时段</b><p>交通采用赛后 90 分钟疏散能力；餐饮、公卫按峰值周转率而非日均供给计算。</p></article>
                      <article><b>赛事韧性</b><p>加入极端天气、应急医疗、通信并发和人群分区等非日常约束。</p></article>
                      <article><b>赛后利用</b><p>选址目标同时惩罚闲置资产，优先旅馆转公寓、球迷区转社区公园等可复用方案。</p></article>
                    </div>
                    <div className="objective">max J = 赛事承载提升 + 赛后公共收益 − 建设与闲置成本</div>
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
