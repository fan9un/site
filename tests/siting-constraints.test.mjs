import assert from "node:assert/strict";
import test from "node:test";
import {
  assessCandidateSuitability,
  hardExclusionRadius,
} from "../app/siting-constraints.ts";

const origin = { lat: 0, lng: 0 };
const northByKm = (km, kind) => ({ lat: km / 111.195, lng: 0, kind });

test("养老和学校不会落入机场近邻", () => {
  for (const factor of ["care", "education"]) {
    const result = assessCandidateSuitability(origin, factor, [northByKm(6, "airport")]);
    assert.equal(result.eligible, false);
    assert.equal(result.score, 0);
  }
  assert.equal(hardExclusionRadius("airport", "care"), 8);
});

test("社区文化设施不会落入港区近邻", () => {
  const result = assessCandidateSuitability(origin, "culture", [northByKm(3, "port")]);
  assert.equal(result.eligible, false);
  assert.equal(hardExclusionRadius("port", "culture"), 5);
});

test("垃圾和污水设施会淘汰敏感设施候选", () => {
  assert.equal(
    assessCandidateSuitability(origin, "medical", [northByKm(2, "waste")]).eligible,
    false,
  );
  assert.equal(
    assessCandidateSuitability(origin, "green", [northByKm(1.5, "wastewater")]).eligible,
    false,
  );
});

test("警戒圈外候选保留，并给出可审计距离", () => {
  const result = assessCandidateSuitability(origin, "care", [northByKm(14, "airport")]);
  assert.equal(result.eligible, true);
  assert.equal(result.score, 100);
  assert.match(result.notes[0], /距机场 14\.0km（红线 8\.0km）/);
});

test("冲突源缺失不会伪装成已完成核验", () => {
  const result = assessCandidateSuitability(origin, "care", []);
  assert.equal(result.eligible, true);
  assert.equal(result.score, 72);
  assert.match(result.notes[0], /未取得.*冲突源数据/);
});
