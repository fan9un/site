import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const tencentSearch = await readFile(
  new URL("../app/api/tencent/search/route.ts", import.meta.url),
  "utf8",
);
const qccRoute = await readFile(
  new URL("../app/api/qcc/enrich/route.ts", import.meta.url),
  "utf8",
);
const browserKeyRoute = await readFile(
  new URL("../app/api/tencent/browser-key/route.ts", import.meta.url),
  "utf8",
);
const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");

test("前端不再静态嵌入地图 Key，也不收集临时服务凭证", () => {
  assert.doesNotMatch(page, /NEXT_PUBLIC_TENCENT_MAP_KEY/);
  assert.doesNotMatch(page, /临时覆盖 Key|临时企查查 Token/);
  assert.match(page, /\/api\/tencent\/browser-key/);
});

test("服务端接口拒绝由公共访客注入第三方凭证", () => {
  assert.doesNotMatch(tencentSearch, /body\.key/);
  assert.doesNotMatch(qccRoute, /body\.authorization/);
  assert.match(qccRoute, /process\.env\.QCC_AUTHORIZATION/);
});

test("浏览器地图 Key 运行时下发且禁止缓存", () => {
  assert.match(browserKeyRoute, /TENCENT_MAP_BROWSER_KEY/);
  assert.match(browserKeyRoute, /Cache-Control.*no-store/s);
});

test("公开环境变量模板只包含空凭证占位", () => {
  for (const key of [
    "TENCENT_MAP_SERVICE_KEY",
    "TENCENT_MAP_BROWSER_KEY",
    "TIANDITU_SERVICE_KEY",
    "QCC_AUTHORIZATION",
    "OPENROUTESERVICE_API_KEY",
  ]) {
    assert.match(envExample, new RegExp(`^${key}=$`, "m"));
  }
});
