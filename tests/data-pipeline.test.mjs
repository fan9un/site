import assert from "node:assert/strict";
import test from "node:test";
import {
  employmentOpportunityIndex,
  fitHedonicModel,
  gcj02ToWgs84,
  parseEnterpriseCsv,
  parseLegalParcelGeoJson,
  wgs84ToGcj02,
} from "../app/data-pipeline.ts";
import { normalizeQccCompany } from "../app/qcc-mcp.ts";

test("GCJ-02 与 WGS-84 往返误差保持在米级以内", () => {
  const wgs = { lat: 24.5127, lng: 118.1392 };
  const gcj = wgs84ToGcj02(wgs);
  const restored = gcj02ToWgs84(gcj);
  assert.ok(Math.abs(restored.lat - wgs.lat) < 1e-6);
  assert.ok(Math.abs(restored.lng - wgs.lng) < 1e-6);
  assert.ok(Math.abs(gcj.lng - wgs.lng) > 0.001);
});

test("没有行业字段的岗位 POI 不会被误判为行业单一", () => {
  const result = employmentOpportunityIndex({
    zone: { id: "z1", lat: 24.51, lng: 118.13 },
    facilities: [
      { id: "job-1", lat: 24.52, lng: 118.14, capacity: 1000, quality: 0.9 },
    ],
    workingPopulation: 5000,
    fallbackDiversity: 47,
  });
  assert.equal(result.diversity, 47);
  assert.equal(result.diversitySource, "fallback");
});

test("行业数据能够形成就业机会多样性指数", () => {
  const industries = ["数字与信息", "金融服务", "制造与工业", "商贸与消费"];
  const result = employmentOpportunityIndex({
    zone: { id: "z1", lat: 24.51, lng: 118.13 },
    facilities: industries.map((industryCategory, index) => ({
      id: `job-${index}`,
      lat: 24.51 + index * 0.001,
      lng: 118.13,
      capacity: 500,
      quality: 0.9,
      industryCategory,
    })),
    workingPopulation: 5000,
  });
  assert.equal(result.categoryCount, 4);
  assert.equal(result.diversitySource, "industry_data");
  assert.ok(result.diversity > 70);
});

test("企业 CSV 默认按 WGS-84 导入并转换为平台坐标", () => {
  const rows = parseEnterpriseCsv(
    "name,lat,lng,industry,employees\n示例科技,24.5127,118.1392,软件和信息服务,320",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sourceCoordinateSystem, "wgs84");
  assert.equal(rows[0].capacity, 320);
  assert.equal(rows[0].industryCategory, "数字与信息");
  assert.ok(Math.abs(rows[0].lng - 118.1392) > 0.001);
});

test("享乐价格模型拒绝小样本，并接受覆盖三个小区的合格样本", () => {
  const makeObservation = (index) => ({
    zoneId: `z${(index % 3) + 1}`,
    unitPrice: 18000 + index * 260 + (index % 3) * 1200,
    area: 70 + (index % 8) * 5,
    buildingAge: index % 20,
    floorRatio: 1.5 + (index % 5) * 0.2,
    greenRatio: 0.25 + (index % 6) * 0.03,
    distanceCbdKm: 3 + (index % 10),
    transactionMonth: 2025 * 12 + (index % 12) + 1,
    serviceValue: 45 + (index % 3) * 12,
  });
  assert.throws(() => fitHedonicModel(Array.from({ length: 20 }, (_, index) => makeObservation(index))), /至少需要 30 条/);
  const audit = fitHedonicModel(Array.from({ length: 36 }, (_, index) => makeObservation(index)));
  assert.equal(audit.sampleSize, 36);
  assert.equal(audit.zoneCount, 3);
  assert.ok(Number.isFinite(audit.adjustedR2));
});

test("法定控规仅接受批准文号和明确的面积、地价单位", () => {
  const valid = JSON.stringify({
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[[118.13, 24.50], [118.14, 24.50], [118.14, 24.51], [118.13, 24.51], [118.13, 24.50]]],
      },
      properties: {
        legal_status: "approved",
        approval_ref: "厦规批2026-001",
        area_ha: 1.2,
        land_price_10k_per_mu: 280,
        zoning_allowed: "医疗|教育",
      },
    }],
  });
  const parcels = parseLegalParcelGeoJson(valid);
  assert.equal(parcels.length, 1);
  assert.equal(parcels[0].approvalRef, "厦规批2026-001");
  assert.deepEqual(parcels[0].zoningAllowed.sort(), ["education", "medical"]);

  const missingUnits = valid.replace('"area_ha":1.2', '"area":12000');
  assert.throws(() => parseLegalParcelGeoJson(missingUnits), /未发现可用法定地块/);

  const placeholderApproval = valid.replace("厦规批2026-001", "请替换为真实批准文号");
  assert.throws(() => parseLegalParcelGeoJson(placeholderApproval), /未发现可用法定地块/);
});

test("企查查只接受唯一精确主体，并优先使用年报从业人数", () => {
  const matched = normalizeQccCompany({
    inputId: "job-1",
    inputName: "示例科技有限公司",
    query: {
      匹配结果: "唯一精确匹配",
      企业信息: { 企业名称: "示例科技有限公司", 统一社会信用代码: "91320000TEST" },
    },
    registration: {
      企业名称: "示例科技有限公司",
      统一社会信用代码: "91320000TEST",
      国标行业: "软件和信息技术服务业",
      注册地址: "示例注册地址",
    },
    profile: { 企查查行业: "产业互联网" },
    annualReports: {
      企业年报信息: [{
        年报年度: "2025年度报告",
        企业基本信息: { 从业人数: "326人" },
        社保信息: { 城镇职工基本养老保险: "301人" },
      }],
    },
  });
  assert.equal(matched.status, "matched");
  assert.equal(matched.employeeCount, 326);
  assert.equal(matched.employeeSource, "annual_report_employees");
  assert.equal(matched.industryCategory, "数字与信息");

  const ambiguous = normalizeQccCompany({
    inputId: "job-2",
    inputName: "同名公司",
    query: { 匹配结果: "返回多个候选主体" },
  });
  assert.equal(ambiguous.status, "ambiguous");
  assert.equal(ambiguous.employeeCount, undefined);
});

test("年报不披露从业人数时仅把参保人数标为下界代理", () => {
  const result = normalizeQccCompany({
    inputId: "job-3",
    inputName: "示例数据有限公司",
    query: {
      匹配结果: "唯一精确匹配",
      企业信息: { 企业名称: "示例数据有限公司" },
    },
    registration: { 国标行业: "软件和信息技术服务业" },
    annualReports: {
      企业年报信息: [{
        年报年度: "2025年度报告",
        企业基本信息: { 从业人数: "企业选择不公示" },
        社保信息: {
          城镇职工基本养老保险: "455人",
          工伤保险: "461人",
        },
      }],
    },
  });
  assert.equal(result.employeeCount, 461);
  assert.equal(result.employeeSource, "annual_social_insurance");
  assert.match(result.note, /下界代理/);
});
