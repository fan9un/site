const endpoint = process.env.QCC_MCP_ENDPOINT;
const authorization = process.env.QCC_AUTHORIZATION;
const searchKey = process.env.QCC_SEARCH_KEY?.trim();

if (!endpoint || !authorization) {
  throw new Error("QCC_MCP_ENDPOINT and QCC_AUTHORIZATION are required");
}

function parsePayload(text) {
  const dataLines = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  const candidate = dataLines.at(-1) ?? text;
  return JSON.parse(candidate);
}

function parsedToolText(result) {
  const text = result?.content?.find((item) => item?.type === "text")?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function collectFields(value, matcher, path = "", found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectFields(item, matcher, `${path}[${index}]`, found));
    return found;
  }
  if (!value || typeof value !== "object") return found;
  Object.entries(value).forEach(([key, item]) => {
    const nextPath = path ? `${path}.${key}` : key;
    if (matcher.test(key) && (typeof item === "string" || typeof item === "number")) {
      found.push({ path: nextPath, value: item });
    }
    collectFields(item, matcher, nextPath, found);
  });
  return found;
}

async function send(body, sessionId) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`QCC MCP HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  return {
    payload: text.trim() ? parsePayload(text) : null,
    sessionId: response.headers.get("mcp-session-id") ?? sessionId,
  };
}

const initialized = await send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "urban-housing-planning-probe", version: "1.0.0" },
  },
});

await send(
  { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
  initialized.sessionId,
);

const listed = await send(
  { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
  initialized.sessionId,
);

const tools = listed.payload?.result?.tools ?? [];
const result = {
  protocolVersion: initialized.payload?.result?.protocolVersion,
  serverInfo: initialized.payload?.result?.serverInfo,
  tools: tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  })),
};

if (searchKey) {
  result.samples = {};
  for (const name of [
    "get_company_by_query",
    "get_company_registration_info",
    "get_company_profile",
    "get_annual_reports",
  ]) {
    const called = await send(
      {
        jsonrpc: "2.0",
        id: `${name}-sample`,
        method: "tools/call",
        params: { name, arguments: { searchKey } },
      },
      initialized.sessionId,
    );
    const parsed = parsedToolText(called.payload?.result ?? called.payload);
    result.samples[name] = collectFields(
      parsed,
      /匹配结果|企业名称|统一社会信用代码|注册地址|所属行业|行业|年报年度|从业人数|养老保险|医疗保险/,
    );
  }
}

console.log(JSON.stringify(result, null, 2));
