import assert from "node:assert/strict";
import test from "node:test";

import { defaultOptionSpec, defaultResearchConfig } from "../lib/research/config.ts";
import { deriveEvidenceCounts, pairedBootstrapComparison, pairedRealityCheck, runResearchPanel } from "../lib/research/evaluate.ts";
import { auditScenarioDecision, evaluateCounterfactual, replayActions } from "../lib/research/replay.ts";
import { generateScenario } from "../lib/research/scenario.ts";

test("paired comparisons use seed-aligned policy differences", () => {
  const panel = runResearchPanel(Array.from({ length: 60 }, (_, index) => index + 1));
  const comparison = pairedBootstrapComparison(panel, "INVENTORY_TOXICITY_AWARE", "BASELINE", 500, 91);
  const directMean = panel.rows.INVENTORY_TOXICITY_AWARE.reduce(
    (sum, row, index) => sum + row.netPnl - panel.rows.BASELINE[index].netPnl,
    0,
  ) / panel.seeds.length;
  assert.ok(Math.abs(comparison.observedMeanDifference - directMean) < 1e-10);
  assert.equal(comparison.resamples, 500);
});

test("evidence counts are measured from simulated rows and detect a failed run", () => {
  const seeds = [1, 2, 3, 4];
  const panel = runResearchPanel(seeds);
  const clean = deriveEvidenceCounts([panel], seeds);
  assert.equal(clean.expectedRunCount, 12);
  assert.equal(clean.reconciledRunCount, 12);
  assert.equal(clean.terminalFlatRunCount, 12);
  assert.equal(clean.policiesUseCommonSeeds, true);
  assert.ok(clean.maxAbsReconciliationError < 1e-6);

  const tampered = structuredClone(panel);
  tampered.rows.DELTA_HEDGED[1].reconciled = false;
  tampered.rows.BASELINE[2].finalOptionInventory = 1;
  tampered.rows.INVENTORY_TOXICITY_AWARE[3].seed = 99;
  tampered.rows.INVENTORY_TOXICITY_AWARE.pop();
  const counts = deriveEvidenceCounts([tampered], seeds);
  assert.equal(counts.reconciledRunCount, 10);
  assert.equal(counts.terminalFlatRunCount, 10);
  assert.equal(counts.policySeedCount.INVENTORY_TOXICITY_AWARE, 3);
  assert.equal(counts.policiesUseCommonSeeds, false);
});

test("Reality Check declares a benchmark and preserves pairing", () => {
  const panel = runResearchPanel(Array.from({ length: 60 }, (_, index) => index + 1));
  const result = pairedRealityCheck(panel, "BASELINE", ["DELTA_HEDGED", "INVENTORY_TOXICITY_AWARE"], 400, 92);
  assert.equal(result.benchmark, "BASELINE");
  assert.equal(result.pairingPreserved, true);
  assert.ok(result.bootstrapPValue > 0 && result.bootstrapPValue <= 1);
  assert.match(result.nullHypothesis, /benchmark/);
});

test("counterfactual expected utility is invariant to realized outcomes", () => {
  const scenario = generateScenario(42, defaultResearchConfig, defaultOptionSpec);
  const action = replayActions(defaultResearchConfig.baseOptionHalfSpread)[2];
  const state = {
    time: 4,
    spot: scenario.states[4].spot,
    volatility: scenario.states[4].volatility,
    fairValue: 2.5,
    optionInventory: 0,
    posterior: { informedSell: 0.1, uninformed: 0.8, informedBuy: 0.1 },
  };
  const buyEvent = { ...scenario.events[4], side: "BUY", reservationDistance: 1, marketOrderSize: 3, queueAhead: 0 };
  const sellEvent = { ...buyEvent, side: "SELL" };
  const buyResult = evaluateCounterfactual(action, state, buyEvent, scenario.states[5], scenario);
  const sellResult = evaluateCounterfactual(action, state, sellEvent, { ...scenario.states[5], spot: scenario.states[5].spot * 1.05 }, scenario);
  assert.equal(buyResult.expectedUtility, sellResult.expectedUtility);
  assert.notEqual(buyResult.realizedUtility, sellResult.realizedUtility);
});

test("all counterfactual actions face one shared latent event", () => {
  const scenario = generateScenario(11, defaultResearchConfig, defaultOptionSpec);
  const decision = auditScenarioDecision(
    scenario,
    8,
    0,
    { informedSell: 0.1, uninformed: 0.8, informedBuy: 0.1 },
  );
  assert.equal(decision.alternatives.length, 4);
  assert.equal(decision.event, scenario.events[8]);
  assert.ok(decision.regret >= 0);
});

test("a tighter quote can fill under the shared event when a base quote cannot", () => {
  const scenario = generateScenario(5, defaultResearchConfig, defaultOptionSpec);
  const state = {
    time: 3,
    spot: scenario.states[3].spot,
    volatility: scenario.states[3].volatility,
    fairValue: 2.5,
    optionInventory: 0,
    posterior: { informedSell: 0.1, uninformed: 0.8, informedBuy: 0.1 },
  };
  const event = { ...scenario.events[3], side: "BUY", reservationDistance: 0.09, marketOrderSize: 3, queueAhead: 0 };
  const [tight, base] = replayActions(defaultResearchConfig.baseOptionHalfSpread).slice(1, 3);
  const tightResult = evaluateCounterfactual(tight, state, event, scenario.states[4], scenario);
  const baseResult = evaluateCounterfactual(base, state, event, scenario.states[4], scenario);
  assert.equal(tightResult.fill, -1);
  assert.equal(baseResult.fill, 0);
});
