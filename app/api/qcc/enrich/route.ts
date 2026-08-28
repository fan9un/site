import { NextRequest, NextResponse } from "next/server";
import {
  normalizeQccCompany,
  QccMcpClient,
  type QccCompanyEnrichment,
} from "../../../qcc-mcp";

type CompanyInput = { id: string; name: string };

function validCompany(value: CompanyInput) {
  return Boolean(value?.id?.trim() && value?.name?.trim() && value.name.length <= 120);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    companies?: CompanyInput[];
  };
  const companies = (body.companies ?? []).filter(validCompany).slice(0, 6);
  if (!companies.length) {
    return NextResponse.json({ error: "请先提供 1–6 个带名称的企业就业点。" }, { status: 400 });
  }

  const configured = process.env.QCC_AUTHORIZATION?.trim();
  const rawAuthorization = configured;
  if (!rawAuthorization) {
    return NextResponse.json(
      { error: "服务端尚未配置企查查授权，请由管理员设置 QCC_AUTHORIZATION。" },
      { status: 503 },
    );
  }
  const authorization = /^Bearer\s/i.test(rawAuthorization)
    ? rawAuthorization
    : `Bearer ${rawAuthorization}`;
  const client = new QccMcpClient(
    authorization,
    process.env.QCC_COMPANY_MCP_ENDPOINT?.trim(),
  );

  try {
    await client.initialize();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "企查查 MCP 初始化失败。" },
      { status: 502 },
    );
  }

  const results: QccCompanyEnrichment[] = [];
  for (const company of companies) {
    try {
      const query = await client.call("get_company_by_query", company.name.trim());
      const matchResult = String(query["匹配结果"] ?? "");
      if (!/唯一精确匹配/.test(matchResult)) {
        results.push(normalizeQccCompany({
          inputId: company.id,
          inputName: company.name,
          query,
        }));
        continue;
      }
      const enterprise = (query["企业信息"] ?? {}) as Record<string, unknown>;
      const searchKey = String(enterprise["统一社会信用代码"] ?? company.name);
      const [registration, profile, annualReports] = await Promise.all([
        client.call("get_company_registration_info", searchKey),
        client.call("get_company_profile", searchKey),
        client.call("get_annual_reports", searchKey),
      ]);
      results.push(normalizeQccCompany({
        inputId: company.id,
        inputName: company.name,
        query,
        registration,
        profile,
        annualReports,
      }));
    } catch (error) {
      results.push({
        inputId: company.id,
        inputName: company.name,
        status: "error",
        note: error instanceof Error ? error.message : "企查查校准失败。",
      });
    }
  }

  return NextResponse.json({
    source: "qcc_company_mcp",
    generatedAt: new Date().toISOString(),
    requested: companies.length,
    matched: results.filter((item) => item.status === "matched").length,
    results,
    methodology: "腾讯/导入坐标保留为工作地点代理；企查查只校准唯一精确主体的行业和年报人数。",
  });
}
