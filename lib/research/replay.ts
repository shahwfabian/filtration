import { optionAnalytics } from "./policy.ts";
import type { LatentCustomerEvent, MarketState, Scenario, ToxicityPosterior } from "./types.ts";

export type ReplayAction = {
  name: "PASS" | "TIGHT" | "BASE" | "WIDE";
  bidDistance: number;
  askDistance: number;
  size: number;
};

export type ReplayDecisionState = {
  time: number;
  spot: number;
  volatility: number;
  fairValue: number;
  optionInventory: number;
  posterior: ToxicityPosterior;
};

export type CounterfactualResult = {
  action: ReplayAction;
  feasible: boolean;
  fill: number;
  executionPrice: number | null;
  realizedPnl: number;
  riskPenalty: number;
  realizedUtility: number;
  expectedUtility: number;
};

export type AuditedDecision = {
  state: ReplayDecisionState;
  selectedAction: ReplayAction;
  event: LatentCustomerEvent;
  nextState: MarketState;
  alternatives: CounterfactualResult[];
  selectedUtility: number;
  bestUtility: number;
  regret: number;
};

export const replayActions = (baseHalfSpread: number): ReplayAction[] => [
  { name: "PASS", bidDistance: Infinity, askDistance: Infinity, size: 0 },
  { name: "TIGHT", bidDistance: baseHalfSpread * 0.65, askDistance: baseHalfSpread * 0.65, size: 1 },
  { name: "BASE", bidDistance: baseHalfSpread, askDistance: baseHalfSpread, size: 1 },
  { name: "WIDE", bidDistance: baseHalfSpread * 1.8, askDistance: baseHalfSpread * 1.8, size: 1 },
];

function expectedUtility(
  action: ReplayAction,
  state: ReplayDecisionState,
  scenario: Scenario,
) {
  if (action.size === 0) return 0;
  const { config, option } = scenario;
  const analytics = optionAnalytics({
    time: state.time,
    spot: state.spot,
    volatility: state.volatility,
    config,
    option,
  });
  const buyProbability = 0.5 * state.posterior.uninformed
    + config.informedSideAccuracy * state.posterior.informedBuy
    + (1 - config.informedSideAccuracy) * state.posterior.informedSell;
  const sellProbability = 1 - buyProbability;
  const buyCross = Math.exp(-config.distanceSensitivity * action.askDistance);
  const sellCross = Math.exp(-config.distanceSensitivity * action.bidDistance);
  const buyInformedShare = buyProbability > 0
    ? config.informedSideAccuracy * state.posterior.informedBuy / buyProbability
    : 0;
  const sellInformedShare = sellProbability > 0
    ? config.informedSideAccuracy * state.posterior.informedSell / sellProbability
    : 0;
  const optionMoveScale = analytics.delta * state.spot * state.volatility * Math.sqrt(config.dtYears) * config.informedReturnSignal;
  const expectedBuyMarkout = optionMoveScale * buyInformedShare;
  const expectedSellMarkout = optionMoveScale * sellInformedShare;
  const expectedSellToCustomer = (action.askDistance - expectedBuyMarkout) * option.multiplier - config.optionFeePerContract;
  const expectedBuyFromCustomer = (action.bidDistance - expectedSellMarkout) * option.multiplier - config.optionFeePerContract;
  const oneStepVariance = (analytics.delta * state.spot * state.volatility * Math.sqrt(config.dtYears)) ** 2;
  const sellInventoryPenalty = config.riskAversion * oneStepVariance * ((state.optionInventory - action.size) ** 2 - state.optionInventory ** 2);
  const buyInventoryPenalty = config.riskAversion * oneStepVariance * ((state.optionInventory + action.size) ** 2 - state.optionInventory ** 2);
  return config.arrivalProbability * (
    buyProbability * buyCross * (expectedSellToCustomer - sellInventoryPenalty)
    + sellProbability * sellCross * (expectedBuyFromCustomer - buyInventoryPenalty)
  );
}

export function evaluateCounterfactual(
  action: ReplayAction,
  state: ReplayDecisionState,
  event: LatentCustomerEvent,
  nextState: MarketState,
  scenario: Scenario,
): CounterfactualResult {
  const { config, option } = scenario;
  const feasible = action.size === 0 || (
    Number.isInteger(action.size)
    && action.size > 0
    && state.optionInventory + action.size <= config.maxOptionInventory
    && state.optionInventory - action.size >= -config.maxOptionInventory
  );
  const nextAnalytics = optionAnalytics({
    time: state.time + 1,
    spot: nextState.spot,
    volatility: nextState.volatility,
    config,
    option,
  });
  const availableAfterQueue = Math.max(0, event.marketOrderSize - event.queueAhead);
  const possibleQuantity = Math.min(action.size, availableAfterQueue);
  let fill = 0;
  let executionPrice: number | null = null;
  if (feasible && possibleQuantity > 0 && event.side === "BUY" && event.reservationDistance >= action.askDistance) {
    fill = -possibleQuantity;
    executionPrice = state.fairValue + action.askDistance;
  }
  if (feasible && possibleQuantity > 0 && event.side === "SELL" && event.reservationDistance >= action.bidDistance) {
    fill = possibleQuantity;
    executionPrice = state.fairValue - action.bidDistance;
  }
  const realizedPnl = fill === 0 || executionPrice === null
    ? 0
    : fill * (nextAnalytics.call - executionPrice) * option.multiplier - Math.abs(fill) * config.optionFeePerContract;
  const oneStepVariance = (optionAnalytics({
    time: state.time,
    spot: state.spot,
    volatility: state.volatility,
    config,
    option,
  }).delta * state.spot * state.volatility * Math.sqrt(config.dtYears)) ** 2;
  const riskPenalty = feasible
    ? config.riskAversion * oneStepVariance * ((state.optionInventory + fill) ** 2 - state.optionInventory ** 2)
    : Infinity;
  return {
    action,
    feasible,
    fill,
    executionPrice,
    realizedPnl,
    riskPenalty,
    realizedUtility: feasible ? realizedPnl - riskPenalty : -Infinity,
    expectedUtility: feasible ? expectedUtility(action, state, scenario) : -Infinity,
  };
}

export function auditScenarioDecision(
  scenario: Scenario,
  time: number,
  optionInventory: number,
  posterior: ToxicityPosterior,
  actions = replayActions(scenario.config.baseOptionHalfSpread),
): AuditedDecision {
  if (!Number.isInteger(time) || time < 0 || time >= scenario.events.length) throw new RangeError("Replay time is outside the scenario");
  const marketState = scenario.states[time];
  const analytics = optionAnalytics({ time, spot: marketState.spot, volatility: marketState.volatility, config: scenario.config, option: scenario.option });
  const state: ReplayDecisionState = {
    time,
    spot: marketState.spot,
    volatility: marketState.volatility,
    fairValue: analytics.call,
    optionInventory,
    posterior: { ...posterior },
  };
  const event = scenario.events[time];
  const nextState = scenario.states[time + 1];
  const alternatives = actions.map(action => evaluateCounterfactual(action, state, event, nextState, scenario));
  const feasible = alternatives.filter(result => result.feasible);
  const selected = feasible.reduce((best, result) => result.expectedUtility > best.expectedUtility ? result : best, feasible[0]);
  const best = feasible.reduce((current, result) => result.realizedUtility > current.realizedUtility ? result : current, feasible[0]);
  return {
    state,
    selectedAction: selected.action,
    event,
    nextState,
    alternatives,
    selectedUtility: selected.realizedUtility,
    bestUtility: best.realizedUtility,
    regret: Math.max(0, best.realizedUtility - selected.realizedUtility),
  };
}

