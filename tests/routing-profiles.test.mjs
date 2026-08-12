import assert from "node:assert/strict";
import test from "node:test";
import {
  openRouteServiceProfile,
  routeProfileLabel,
  routeProfileOptions,
} from "../app/routing-profiles.ts";

test("路网方式映射到正确的 OpenRouteService profile", () => {
  assert.equal(openRouteServiceProfile("walking"), "foot-walking");
  assert.equal(openRouteServiceProfile("cycling"), "cycling-regular");
  assert.equal(openRouteServiceProfile("driving"), "driving-car");
});

test("三种方式在界面中有明确来源与额度说明", () => {
  assert.deepEqual(
    routeProfileOptions.map((option) => option.value),
    ["driving", "walking", "cycling"],
  );
  assert.match(routeProfileLabel("walking"), /步行/);
  assert.match(routeProfileOptions[0].quotaNote, /不消耗 ORS/);
  assert.match(routeProfileOptions[1].quotaNote, /消耗 1 次/);
});
