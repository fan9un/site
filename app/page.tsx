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

type HousingZone = {
  id: string;
  name: string;
  subtitle: string;
  population: number;
  price: number;
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
  { key: "medical", label: "医疗健康", short: "医", weight: 13, radius: "≤ 1,000m" },
  { key: "education", label: "教育配套", short: "学", weight: 11, radius: "300–500m" },
  { key: "transit", label: "交通出行", short: "行", weight: 10, radius: "300–1,000m" },
  { key: "care", label: "养老托育", short: "护", weight: 10, radius: "≤ 300m" },
  { key: "retail", label: "日常购物", short: "购", weight: 9, radius: "300–500m" },
  { key: "green", label: "公园绿地", short: "园", weight: 8, radius: "300–1,000m" },
  { key: "culture", label: "文化休闲", short: "文", weight: 7, radius: "500–1,000m" },
  { key: "commerce", label: "商业消费", short: "商", weight: 7, radius: "≤ 1,000m" },
  { key: "employment", label: "就业密度", short: "业", weight: 6, radius: "全区" },
  { key: "policy", label: "政策潜力", short: "策", weight: 6, radius: "宏观" },
  { key: "dining", label: "餐饮服务", short: "食", weight: 5, radius: "≤ 300m" },
] as const;

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
    risk: 2,
    metrics: {
      medical: 82,
      education: 76,
      transit: 88,
      care: 63,
      retail: 84,
      green: 71,
      culture: 65,
      commerce: 79,
      employment: 73,
      policy: 72,
      dining: 86,
    },
  },
  {
    id: "hewan",
    name: "河湾社区",
    subtitle: "滨水住区 · 老龄化 22%",
    population: 6.2,
    price: 3.1,
    risk: 4,
    metrics: {
      medical: 49,
      education: 61,
      transit: 58,
      care: 37,
      retail: 72,
      green: 90,
      culture: 54,
      commerce: 48,
      employment: 52,
      policy: 68,
      dining: 65,
    },
  },
  {
    id: "donggang",
    name: "东港里",
    subtitle: "产城混合 · 通勤人口多",
    population: 7.4,
    price: 2.7,
    risk: 7,
    metrics: {
      medical: 42,
      education: 46,
      transit: 69,
      care: 32,
      retail: 56,
      green: 38,
      culture: 41,
      commerce: 62,
      employment: 89,
      policy: 78,
      dining: 67,
    },
  },
  {
    id: "nanhu",
    name: "南湖家园",
    subtitle: "成熟住区 · 儿童占比 18%",
    population: 5.8,
    price: 3.7,
    risk: 1,
    metrics: {
      medical: 75,
      education: 91,
      transit: 72,
      care: 68,
      retail: 81,
      green: 84,
      culture: 78,
      commerce: 71,
      employment: 59,
      policy: 57,
      dining: 74,
    },
  },
  {
    id: "xicheng",
    name: "西城旧里",
    subtitle: "存量更新 · 建成 28 年",
    population: 9.1,
    price: 3.4,
    risk: 5,
    metrics: {
      medical: 67,
      education: 72,
      transit: 81,
      care: 43,
      retail: 88,
      green: 35,
      culture: 70,
      commerce: 83,
      employment: 66,
      policy: 49,
      dining: 91,
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
  { x: 18, y: 22, icon: "医", label: "社区医院", tone: "coral" },
  { x: 34, y: 58, icon: "学", label: "实验小学", tone: "blue" },
  { x: 62, y: 31, icon: "园", label: "河湾公园", tone: "lime" },
  { x: 73, y: 68, icon: "行", label: "轨道站", tone: "blue" },
  { x: 51, y: 78, icon: "护", label: "托育中心", tone: "coral" },
  { x: 85, y: 19, icon: "购", label: "生鲜市集", tone: "lime" },
];

const cupMarkers = [
  { x: 44, y: 42, icon: "场", label: "临海竞赛中心", tone: "coral" },
  { x: 20, y: 71, icon: "站", label: "临港站", tone: "blue" },
  { x: 74, y: 27, icon: "宿", label: "现有旅馆群", tone: "lime" },
  { x: 79, y: 72, icon: "医", label: "赛事医院", tone: "coral" },
];

function weightedScore(metrics: MetricMap, factors: readonly { key: string; weight: number }[]) {
  const total = factors.reduce((sum, factor) => sum + factor.weight, 0);
  return factors.reduce(
    (sum, factor) => sum + (metrics[factor.key] ?? 0) * factor.weight,
    0,
  ) / total;
}

function stdDev(values: number[]) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
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
  const [factorView, setFactorView] = useState<"core" | "all">("core");
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
      const service = weightedScore(zone.metrics, housingFactors);
      const priceSignal = 45 + ((zone.price - minPrice) / (maxPrice - minPrice)) * 45;
      const score = Math.max(0, service * 0.78 + priceSignal * 0.22 - zone.risk);
      return { ...zone, service, score };
    });
  }, []);

  const meanHousingScore =
    housingScores.reduce((sum, zone) => sum + zone.score, 0) / housingScores.length;
  const cv = stdDev(housingScores.map((zone) => zone.score)) / meanHousingScore;
  const fairness = Math.max(0, 100 - cv * 310);

  const activeHousing =
    housingScores.find((zone) => zone.id === activeHousingId) ?? housingScores[0];
  const activeStadium =
    stadiums.find((stadium) => stadium.id === activeStadiumId) ?? stadiums[0];
  const stadiumScore = weightedScore(activeStadium.metrics, cupFactors);
  const effectiveCapacity = Math.min(...Object.values(activeStadium.limits));
  const capacityRate = (effectiveCapacity / activeStadium.capacity) * 100;

  const housingRecommendations = useMemo<Recommendation[]>(() => {
    const lowZones = [...housingScores].sort((a, b) => a.score - b.score);
    const target = lowZones[0];
    const second = lowZones[1];
    const gapFactor = [...housingFactors].sort(
      (a, b) =>
        (100 - target.metrics[b.key]) * b.weight -
        (100 - target.metrics[a.key]) * a.weight,
    )[0];
    return [
      {
        rank: 1,
        type: gapFactor.label,
        title: `新建${gapFactor.label === "医疗健康" ? "社区卫生服务中心" : gapFactor.label}`,
        place: `${target.name} · 东南生活圈`,
        impact: `价值 +${(8.4 + fairnessWeight / 40).toFixed(1)}`,
        detail: `覆盖约 ${(target.population * 0.72).toFixed(1)} 万人，优先修复“${gapFactor.label}”缺口，并降低区域离散度。`,
        score: 96,
        tone: "lime",
      },
      {
        rank: 2,
        type: "复合设施",
        title: "托育 + 社区养老复合站",
        place: `${second.name} · 滨河路口`,
        impact: "公平性 +4.6",
        detail: `以 15 分钟生活圈共址建设，服务老幼人口，单位投资的公平收益最高。`,
        score: 89,
        tone: "coral",
      },
      {
        rank: 3,
        type: "新增住区",
        title: "适宜新建中密度住区",
        place: "南湖—东港发展轴",
        impact: "新增 1.8 万人",
        detail: "避开内涝与工业缓冲区，复用轨道与教育余量，减少对核心区的新增依赖。",
        score: 82,
        tone: "blue",
      },
    ];
  }, [fairnessWeight, housingScores]);

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
    setFactorView("core");
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
    const context =
      mode === "housing"
        ? `在当前 ${budget.toFixed(1)} 亿元预算和 ${fairnessWeight}% 公平性偏好下，建议先在${housingRecommendations[0].place}建设${housingRecommendations[0].title}。它对低值区的边际提升最大，同时不会继续强化高值中心。`
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
            {factors.slice(0, factorView === "core" ? 6 : factors.length).map((factor) => {
              const score = activeMetrics[factor.key] ?? 0;
              return (
                <div className="factor-row" key={factor.key}>
                  <span className="factor-icon">{factor.short}</span>
                  <span className="factor-copy">
                    <span>
                      {factor.label}
                      <small>{factor.radius}</small>
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
              <span>扩展修正</span>
              <p>安全 · 地形 · 日照 · 微气候 · 洪涝 · 地质 · 年龄结构 · 数字设施</p>
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
                className={`map-marker ${marker.tone}`}
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
              <span><i className="legend-high" />高价值</span>
              <span><i className="legend-mid" />中价值</span>
              <span><i className="legend-low" />待改善</span>
              <span><i className="legend-proposed" />建议选址</span>
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
                  <span>服务价值</span>
                  <strong>{activeHousing.service.toFixed(1)}</strong>
                  <small>可达性 × 容量 × 品质</small>
                </div>
                <div className="score-stat">
                  <span>房价信号</span>
                  <strong>{activeHousing.price.toFixed(1)} 万</strong>
                  <small>用于校准，不直接替代价值</small>
                </div>
                <div className="score-stat warning">
                  <span>最大短板</span>
                  <strong>
                    {
                      [...housingFactors].sort(
                        (a, b) =>
                          activeHousing.metrics[a.key] - activeHousing.metrics[b.key],
                      )[0].label
                    }
                  </strong>
                  <small>优先进入候选设施生成</small>
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

          <div className="recommendation-heading">
            <span>选址建议</span>
            <small>按边际公共收益排序</small>
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

          <button className="run-button" onClick={() => showToast("已生成 24 个候选点并完成多目标排序")}>
            <span>运行新一轮优化</span>
            <small>NSGA-II · 24 候选点 · 3 个帕累托解</small>
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
                      V<sub>i</sub> = 0.78 Σ w<sub>j</sub> · A<sub>ij</sub> + 0.22 P<sub>i</sub> − R<sub>i</sub>
                    </div>
                    <div className="model-grid">
                      <article><b>A · 可达服务</b><p>路网距离衰减 × 设施容量 / 人口需求 × 质量系数，不使用简单的“1/距离”。</p></article>
                      <article><b>P · 房价校准</b><p>房价作为市场信号参与校准，但占比受控，避免把既有高价直接认定为公共价值。</p></article>
                      <article><b>R · 风险约束</b><p>污染、洪涝、地质危险先执行一票否决；地形、日照与工业影响再做乘法修正。</p></article>
                      <article><b>J · 公平目标</b><p>最小化各住区价值的变异系数，同时最大化人口加权收益并约束全生命周期成本。</p></article>
                    </div>
                    <div className="objective">max J = Δ人口加权价值 + λ · Δ公平性 − μ · 全生命周期成本</div>
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
