import assert from "node:assert/strict";
import test from "node:test";
import { FrameBudget, qualitySettings } from "./FrameBudget.ts";

test("fast devices keep their initial quality and a single stall does not lower it", () => {
  const budget = new FrameBudget(false);
  for (let i = 0; i < 500; i++) budget.sample(i === 230 ? 0.15 : 1 / 60);
  assert.equal(budget.tier, "high");
  for (const dt of [NaN, Infinity, -1, 0, 8]) assert.equal(budget.sample(dt), "high");
});

test("sustained slow rendering lowers quality and never automatically oscillates up", () => {
  const desktop = new FrameBudget(false);
  for (let i = 0; i < 120; i++) desktop.sample(0.05);
  assert.equal(desktop.tier, "balanced");
  for (let i = 0; i < 100; i++) desktop.sample(0.05);
  assert.equal(desktop.tier, "economy");
  for (let i = 0; i < 1000; i++) desktop.sample(1 / 120);
  assert.equal(desktop.tier, "economy");
  const mobile = new FrameBudget(true);
  for (let i = 0; i < 120; i++) mobile.sample(0.05);
  assert.equal(mobile.tier, "economy");
});

test("quality budgets disable costly passes and limit resolution and particles", () => {
  assert.equal(qualitySettings("high", false).effects, true);
  assert.equal(qualitySettings("high", true).effects, false);
  assert.equal(qualitySettings("balanced", true).transmission, false);
  const economy = qualitySettings("economy", true);
  assert.ok(economy.dprMax < 1);
  assert.equal(economy.effects, false);
  assert.equal(economy.transmission, false);
  assert.ok(economy.particleFactor < qualitySettings("balanced", true).particleFactor);
});
