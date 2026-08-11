import { classifyIndustry } from "./data-pipeline.ts";

const DEFAULT_ENDPOINT = "https://agent.qcc.com/mcp/company/stream";

type JsonRecord = Record<string, unknown>;

export type QccCompanyEnrichment = {
  inputId: string;
  inputName: string;
  status: "matched" | "ambiguous" | "not_found" | "error";
  companyName?: string;
  creditCode?: string;
  registeredAddress?: string;
  qccIndustry?: string;
  nationalIndustry?: string;
  industryCategory?: string;
  employeeCount?: number;
  employeeYear?: number;
  employeeSource?: "annual_report_employees" | "annual_social_insurance" | "unavailable";
  note: string;
};

function parseSsePayload(text: string) {
  const dataLines = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  return JSON.parse(dataLines.at(-1) ?? text) as JsonRecord;
}

export function parseQccToolText(result: unknown): JsonRecord {
  const content = (result as { content?: Array<{ type?: string; text?: string }> })?.content;
  const text = content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("企查查未返回可解析的文本结果。");
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("企查查返回结构无效。");
  }
  return parsed as JsonRecord;
}

function parsePeople(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  if (typeof value !== "string" || /不公示|未知|暂无|无/.test(value)) return undefined;
  const matched = value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*人?/);
  return matched ? Math.round(Number(matched[1])) : undefined;
}

function latestAnnualReport(payload: JsonRecord) {
  const reports = Array.isArray(payload["企业年报信息"])
    ? (payload["企业年报信息"] as JsonRecord[])
    : [];
  return [...reports]
    .map((report) => ({
      report,
      year: Number(String(report["年报年度"] ?? "").match(/\d{4}/)?.[0] ?? 0),
    }))
    .sort((a, b) => b.year - a.year)[0];
}

export function normalizeQccCompany(args: {
  inputId: string;
  inputName: string;
  query: JsonRecord;
  registration?: JsonRecord;
  profile?: JsonRecord;
  annualReports?: JsonRecord;
}): QccCompanyEnrichment {
  const matchResult = String(args.query["匹配结果"] ?? "");
  if (!/唯一精确匹配/.test(matchResult)) {
    const isAmbiguous = /候选|多匹配|多个/.test(matchResult);
    return {
      inputId: args.inputId,
      inputName: args.inputName,
      status: isAmbiguous ? "ambiguous" : "not_found",
      note: isAmbiguous
        ? "存在多个候选主体，按照企查查规则未自动选择。"
        : "未找到唯一精确企业主体。",
    };
  }

  const enterprise = (args.query["企业信息"] ?? {}) as JsonRecord;
  const companyName = String(
    args.registration?.["企业名称"] ?? enterprise["企业名称"] ?? args.inputName,
  );
  const creditCode = String(
    args.registration?.["统一社会信用代码"] ?? enterprise["统一社会信用代码"] ?? "",
  );
  const qccIndustry = String(args.profile?.["企查查行业"] ?? "").trim();
  const nationalIndustry = String(args.registration?.["国标行业"] ?? "").trim();
  const report = args.annualReports ? latestAnnualReport(args.annualReports) : undefined;
  const basic = (report?.report?.["企业基本信息"] ?? {}) as JsonRecord;
  const disclosedEmployees = parsePeople(basic["从业人数"]);
  const insurance = (report?.report?.["社保信息"] ?? {}) as JsonRecord;
  const insuredCounts = [
    insurance["城镇职工基本养老保险"],
    insurance["职工基本医疗保险"],
    insurance["失业保险"],
    insurance["工伤保险"],
    insurance["生育保险"],
  ]
    .map(parsePeople)
    .filter((value): value is number => value !== undefined);
  const insuredProxy = insuredCounts.length ? Math.max(...insuredCounts) : undefined;
  const employeeCount = disclosedEmployees ?? insuredProxy;
  const employeeSource = disclosedEmployees !== undefined
    ? "annual_report_employees" as const
    : insuredProxy !== undefined
      ? "annual_social_insurance" as const
      : "unavailable" as const;
  const industry = qccIndustry || nationalIndustry;

  return {
    inputId: args.inputId,
    inputName: args.inputName,
    status: "matched",
    companyName,
    creditCode: creditCode || undefined,
    registeredAddress: String(args.registration?.["注册地址"] ?? "").trim() || undefined,
    qccIndustry: qccIndustry || undefined,
    nationalIndustry: nationalIndustry || undefined,
    industryCategory: industry ? classifyIndustry(industry) : undefined,
    employeeCount,
    employeeYear: report?.year || undefined,
    employeeSource,
    note:
      employeeSource === "annual_report_employees"
        ? `采用 ${report?.year} 年报披露从业人数。`
        : employeeSource === "annual_social_insurance"
          ? `${report?.year} 年报未披露从业人数，采用社保参保人数作为岗位下界代理。`
          : "年报未提供可用人数，保留原岗位代理值。",
  };
}

export class QccMcpClient {
  private sessionId?: string;
  private authorization: string;
  private endpoint: string;

  constructor(
    authorization: string,
    endpoint = DEFAULT_ENDPOINT,
  ) {
    this.authorization = authorization;
    this.endpoint = endpoint;
  }

  private async send(body: JsonRecord) {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: this.authorization,
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
        ...(this.sessionId ? { "Mcp-Session-Id": this.sessionId } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`企查查 MCP 返回 HTTP ${response.status}。`);
    }
    this.sessionId = response.headers.get("mcp-session-id") ?? this.sessionId;
    return text.trim() ? parseSsePayload(text) : {};
  }

  async initialize() {
    await this.send({
      jsonrpc: "2.0",
      id: "initialize",
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "city-equity-employment", version: "1.0.0" },
      },
    });
    await this.send({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });
  }

  async call(name: string, searchKey: string) {
    const allowed = new Set([
      "get_company_by_query",
      "get_company_registration_info",
      "get_company_profile",
      "get_annual_reports",
    ]);
    if (!allowed.has(name)) throw new Error("企查查工具不在就业校准白名单内。");
    const payload = await this.send({
      jsonrpc: "2.0",
      id: `${name}-${crypto.randomUUID()}`,
      method: "tools/call",
      params: { name, arguments: { searchKey } },
    });
    const result = (payload as { result?: unknown; error?: { message?: string } }).result;
    if (!result) {
      const message = (payload as { error?: { message?: string } }).error?.message;
      throw new Error(message || "企查查工具调用失败。");
    }
    return parseQccToolText(result);
  }
}
