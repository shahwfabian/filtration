import assert from "node:assert/strict";
import test from "node:test";

import { defaultOptionSpec, defaultResearchConfig, validateResearchConfig } from "../lib/research/config.ts";
import { makeQuote } from "../lib/research/policy.ts";
import { generateScenario } from "../lib/research/scenario.ts";
import { reconcileLedger, simulatePolicy } from "../lib/research/simulate.ts";

test("research scenarios are deterministic and retain separate option and underlying state", () => {
  const first = generateScenario(42, defaultResearchConfig, defaultOptionSpec);
  const second = generateScenario(42, defaultResearchConfig, defaultOptionSpec);
  assert.deepEqual(first, second);
  assert.equal(first.states.length, defaultResearchConfig.steps + 1);
  assert.equal(first.events.length, defaultResearchConfig.steps);
  assert.equal(first.option.strike, 100);
});

test("declared informed customer direction predicts the subsequent signed return", () => {
  const signedReturns = [];
  for (let seed = 1; seed <= 120; seed += 1) {
    const scenario = generateScenario(seed, defaultResearchConfig, defaultOptionSpec);
    for (let time = 0; time < scenario.events.length; time += 1) {
      const event = scenario.events[time];
      if (event.side === null || event.regime === 0) continue;
      const current = scenario.states[time].spot;
      const next = scenario.states[time + 1].spot;
      const rawReturn = (next - current) / current;
      signedReturns.push(event.side === "BUY" ? rawReturn : -rawReturn);
    }
  }
  const meanSignedReturn = signedReturns.reduce((sum, value) => sum + value, 0) / signedReturns.length;
  assert.ok(signedReturns.length > 500);
  assert.ok(meanSignedReturn > 0, `expected positive informed signed return, received ${meanSignedReturn}`);
});

test("option quotes are centered on option value rather than the underlying price", () => {
  const scenario = generateScenario(7, defaultResearchConfig, defaultOptionSpec);
  const result = simulatePolicy(scenario, "BASELINE");
  const first = result.records[0];
  assert.ok(first.fairValue > 0 && first.fairValue < 10);
  assert.ok((first.quote.ask ?? Infinity) < 10);
  assert.ok(first.spot > 90);
});

test("inventory-aware reservation prices move against accumulated option inventory", () => {
  const base = {
    time: 20,
    spot: 101,
    volatility: 0.24,
    posterior: { informedSell: 0.1, uninformed: 0.8, informedBuy: 0.1 },
    policy: "INVENTORY_TOXICITY_AWARE",
    config: defaultResearchConfig,
    option: defaultOptionSpec,
  };
  const longQuote = makeQuote({ ...base, optionInventory: 8 });
  const shortQuote = makeQuote({ ...base, optionInventory: -8 });
  assert.ok(longQuote.reservationPrice < shortQuote.reservationPrice);
});

test("directional toxicity independently widens the threatened side", () => {
  const base = {
    time: 10,
    spot: 100,
    volatility: 0.22,
    optionInventory: 0,
    policy: "INVENTORY_TOXICITY_AWARE",
    config: defaultResearchConfig,
    option: defaultOptionSpec,
  };
  const buyToxic = makeQuote({ ...base, posterior: { informedSell: 0.02, uninformed: 0.18, informedBuy: 0.8 } });
  const sellToxic = makeQuote({ ...base, posterior: { informedSell: 0.8, uninformed: 0.18, informedBuy: 0.02 } });
  assert.ok((buyToxic.askDistance ?? 0) > (sellToxic.askDistance ?? 0));
  assert.ok((sellToxic.bidDistance ?? 0) > (buyToxic.bidDistance ?? 0));
});

test("every simulation liquidates inventory and reconciles cash", () => {
  for (const policy of ["BASELINE", "DELTA_HEDGED", "INVENTORY_TOXICITY_AWARE"]) {
    const result = simulatePolicy(generateScenario(23, defaultResearchConfig, defaultOptionSpec), policy);
    assert.equal(result.finalOptionInventory, 0);
    assert.equal(result.finalUnderlyingInventory, 0);
    assert.equal(result.reconciled, true);
    assert.ok(result.liquidationCost >= 0);
  }
});

test("cash reconciliation is rebuilt from executions rather than from the reported P&L formula", () => {
  for (const seed of [3, 23, 575]) {
    const scenario = generateScenario(seed, defaultResearchConfig, defaultOptionSpec);
    for (const policy of ["BASELINE", "DELTA_HEDGED", "INVENTORY_TOXICITY_AWARE"]) {
      const result = simulatePolicy(scenario, policy);
      const fromLedger = reconcileLedger(result.ledger, result.netPnl);
      assert.equal(fromLedger.reconciled, true, `seed ${seed} ${policy} error ${fromLedger.error}`);
      assert.ok(Math.abs(result.reconciliationError) < 1e-6);
      const optionFills = result.ledger.filter(fill => fill.instrument === "OPTION" && fill.kind === "CUSTOMER");
      assert.equal(optionFills.reduce((total, fill) => total + Math.abs(fill.quantity), 0), result.optionFills);
    }
  }
});

test("reconciliation fails when cash, a fill, or terminal liquidation is misreported", () => {
  const result = simulatePolicy(generateScenario(23, defaultResearchConfig, defaultOptionSpec), "DELTA_HEDGED");
  assert.ok(result.ledger.some(fill => fill.kind === "HEDGE"));

  assert.equal(reconcileLedger(result.ledger, result.netPnl + 0.01).reconciled, false);

  const hedgeIndex = result.ledger.findIndex(fill => fill.kind === "HEDGE");
  const missingHedge = result.ledger.filter((_, index) => index !== hedgeIndex);
  const hedgeCheck = reconcileLedger(missingHedge, result.netPnl);
  assert.equal(hedgeCheck.reconciled, false);
  assert.notEqual(hedgeCheck.underlyingPosition, 0);

  const withoutLiquidation = result.ledger.filter(fill => fill.kind !== "LIQUIDATION");
  const liquidationCheck = reconcileLedger(withoutLiquidation, result.netPnl);
  const openInventory = result.records.at(-1).optionInventory;
  assert.ok(openInventory !== 0 || result.records.at(-1).underlyingInventory !== 0, "fixture must end with open inventory before liquidation");
  assert.equal(liquidationCheck.optionPosition, openInventory);
  assert.equal(liquidationCheck.reconciled, false);
});

test("frictional delta hedging reduces exposure and incurs explicit costs", () => {
  const baselineDelta = [];
  const hedgedDelta = [];
  let totalHedgeFees = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    const scenario = generateScenario(seed, defaultResearchConfig, defaultOptionSpec);
    baselineDelta.push(simulatePolicy(scenario, "BASELINE").maxAbsDelta);
    const hedged = simulatePolicy(scenario, "DELTA_HEDGED");
    hedgedDelta.push(hedged.maxAbsDelta);
    totalHedgeFees += hedged.hedgeFees;
  }
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(mean(hedgedDelta) < mean(baselineDelta));
  assert.ok(totalHedgeFees > 0);
});

test("research configuration rejects impossible domains", () => {
  assert.throws(
    () => validateResearchConfig({ ...defaultResearchConfig, arrivalProbability: 1.2 }, defaultOptionSpec),
    /arrivalProbability/,
  );
  assert.throws(
    () => validateResearchConfig({ ...defaultResearchConfig, steps: 1 }, defaultOptionSpec),
    /steps/,
  );
});

