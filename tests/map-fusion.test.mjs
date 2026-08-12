import assert from "node:assert/strict";
import test from "node:test";
import {
  fuseMapPois,
  normalizePoiName,
  tiandituPoiToGcj02,
} from "../app/map-fusion.ts";

test("天地图 WGS-84 POI 会转成平台 GCJ-02 坐标并保留来源", () => {
  const point = tiandituPoiToGcj02(
    {
      hotPointID: "abc",
      name: "厦门市图书馆",
      lonlat: "118.1392,24.5127",
      typeName: "公共设施",
    },
    "图书馆",
  );
  assert.ok(point);
  assert.equal(point.source, "tianditu");
  assert.ok(Math.abs(point.lng - 118.1392) > 0.001);
});

test("同名近邻设施会被标记为双源确认而不是重复计分", () => {
  const fusion = fuseMapPois(
    [{ id: "qq-1", name: "厦门市中心医院", category: "医院", lat: 24.51, lng: 118.14 }],
    [{ id: "tdt-1", name: "中心医院", category: "医院", lat: 24.5102, lng: 118.1402, source: "tianditu" }],
  );
  assert.equal(fusion.points.length, 1);
  assert.equal(fusion.points[0].source, "cross_verified");
  assert.equal(fusion.crossVerifiedCount, 1);
  assert.equal(fusion.supplementedCount, 0);
});

test("远处或不同名称的天地图设施作为补充点保留", () => {
  const fusion = fuseMapPois(
    [{ id: "qq-1", name: "第一小学", category: "学校", lat: 24.51, lng: 118.14 }],
    [{ id: "tdt-1", name: "第二小学", category: "学校", lat: 24.53, lng: 118.16, source: "tianditu" }],
  );
  assert.equal(fusion.points.length, 2);
  assert.equal(fusion.supplementedCount, 1);
  assert.equal(normalizePoiName("厦门市·中心医院（本部）"), "中心医院");
});
