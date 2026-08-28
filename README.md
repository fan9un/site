# 衡域：城市设施公平规划平台

面向城市住房配套与世界杯场馆承载力的空间评估和组合选址网站。项目融合地图 POI、路网时间矩阵、人口结构、风险折扣、就业结构与多目标优化，房价仅用于模型外部审计。

## 本地运行

要求 Node.js `>=22.13.0`。

```bash
npm install
copy .env.example .env.local
npm run dev
```

然后访问 `http://localhost:3000/`。真实地图和外部数据导入需要在 `.env.local` 中配置相应凭证。

## 环境变量

| 变量 | 用途 | 是否敏感 |
| --- | --- | --- |
| `TENCENT_MAP_SERVICE_KEY` | 服务端 POI 检索 | 是 |
| `TENCENT_MAP_BROWSER_KEY` | 腾讯 JavaScript 地图 | 运行时对浏览器可见，必须设置域名白名单 |
| `TIANDITU_SERVICE_KEY` | 服务端公共设施补充 | 是 |
| `OPENROUTESERVICE_API_KEY` | 步行/骑行矩阵 | 是 |
| `QCC_AUTHORIZATION` | 企查查企业校准 | 是 |
| `OSRM_TABLE_ENDPOINT` | OSRM 矩阵地址 | 否 |
| `SITE_ORIGIN` | Open Graph 可信站点来源 | 否 |

禁止把真实值写入源码或 `.env.example`。详细规则见 [SECURITY.md](SECURITY.md)。

## 验证

```bash
npm test
```

测试覆盖空间约束、设施供需竞争、地图融合、路网方式、就业结构、享乐价格审计和世界杯承载链。

## 公开发布

推荐上传不含 Git 历史的公开源码包。仓库已通过 `.gitignore` 和 `.gitattributes` 排除本地密钥、构建产物、依赖目录与 Sites 项目标识。发布前仍应执行凭证扫描，并轮换所有曾经通过聊天或截图分享的 Key/Token。
