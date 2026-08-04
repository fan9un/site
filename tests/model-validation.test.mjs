import assert from "node:assert/strict";
import test from "node:test";
import {
  competitiveAccessibility,
  explainPriceResidual,
  standardizedIndex,
  weightedRiskMultiplier,
} from "../app/model-validation.ts";

const origin = { lat: 24.5, lng: 118.1 };
const fullWeight = () => 1;

test("设施容量在多个社区之间守恒分配", () => {
  const facility = [{ coord: origin, supply: 1 }];
  const single = competitiveAccessibility(
    "a",
    [{ id: "a", coord: origin, demand: 1 }],
    facility,
    fullWeight,
  );
  const shared = competitiveAccessibility(
    "a",
    [
      { id: "a", coord: origin, demand: 1 },
      { id: "b", coord: origin, demand: 1 },
    ],
    facility,
    fullWeight,
  );
  assert.equal(single, 1);
  assert.equal(shared, 0.5);
});

test("增加供给提高可达性，增加竞争需求降低可达性", () => {
  const zones = [
    { id: "a", coord: origin, demand: 1 },
    { id: "b", coord: origin, demand: 1 },
  ];
  const base = competitiveAccessibility(
    "a",
    zones,
    [{ coord: origin, supply: 1 }],
    fullWeight,
  );
  const doubled = competitiveAccessibility(
    "a",
    zones,
    [{ coord: origin, supply: 2 }],
    fullWeight,
  );
  assert.ok(doubled > base);
  assert.equal(doubled, 1);
});

test("风险折扣有下限且对风险单调", () => {
  const safe = weightedRiskMultiplier({
    geological: 0,
    flood: 0,
    pollution: 0,
    industrial: 0,
    noise: 0,
  });
  const exposed = weightedRiskMultiplier({
    geological: 0.06,
    flood: 0.24,
    pollution: 0.58,
    industrial: 0.64,
    noise: 0.42,
  });
  assert.equal(safe, 1);
  assert.ok(exposed < safe);
  assert.ok(exposed >= 0.55);
});

test("房价与价值使用同口径标准化指数", () => {
  const values = [1, 2, 3, 4, 5];
  assert.equal(standardizedIndex(3, values), 50);
  assert.ok(standardizedIndex(5, values) > standardizedIndex(1, values));
  assert.equal(standardizedIndex(8, [8, 8, 8]), 50);
});

test("价格残差解释不再反转正负方向", () => {
  assert.match(explainPriceResidual(12), /价格显著高于公共服务价值/);
  assert.match(explainPriceResidual(-12), /公共服务价值显著高于价格/);
  assert.match(explainPriceResidual(0), /相对位置接近/);
});
