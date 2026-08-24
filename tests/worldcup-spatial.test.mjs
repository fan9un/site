import assert from "node:assert/strict";
import test from "node:test";
import {
  isWorldCupStadiumDescription,
  worldCupAccessibility,
  worldCupChainForPoi,
  worldCupNominalCapacity,
} from "../app/worldcup-spatial.ts";

test("世界杯 POI 会进入正确的赛事承载链", () => {
  assert.equal(worldCupChainForPoi("五星级酒店"), "住宿");
  assert.equal(worldCupChainForPoi("地铁站"), "交通");
  assert.equal(worldCupChainForPoi("急救中心"), "医疗");
  assert.equal(worldCupChainForPoi("商业综合体"), "餐饮");
  assert.equal(worldCupChainForPoi("公共厕所"), "公卫");
});

test("场馆识别不会把普通赛事设施误当作球场", () => {
  assert.equal(isWorldCupStadiumDescription("国家体育场（鸟巢）"), true);
  assert.equal(isWorldCupStadiumDescription("奥体中心酒店"), false);
});

test("路网时间与距离越大，计入场馆的有效容量越低", () => {
  const nearByRoad = worldCupAccessibility("住宿", 4, 12);
  const farByRoad = worldCupAccessibility("住宿", 4, 55);
  const nearByDistance = worldCupAccessibility("住宿", 2);
  const farByDistance = worldCupAccessibility("住宿", 18);
  assert.ok(nearByRoad > farByRoad);
  assert.ok(nearByDistance > farByDistance);
  assert.equal(worldCupNominalCapacity("地铁站"), 12_000);
});
