import { DirectionalToxicityFilter } from "./toxicity.ts";
import { makeQuote, optionAnalytics } from "./policy.ts";
import type {
  HedgeOrder,
  LedgerFill,
  PolicyKind,
  Quote,
  Scenario,
  SimulationResult,
  StepRecord,
} from "./types.ts";

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export const RECONCILIATION_TOLERANCE = 1e-6;

// Rebuilds positions and cash from individual executions, independently of the
// running counters used to compute the reported P&L components.
export function reconcileLedger(ledger: LedgerFill[], reportedNetPnl: number) {
  const position = (instrument: LedgerFill["instrument"]) => sum(
    ledger.filter(fill => fill.instrument === instrument).map(fill => fill.quantity),
  );
  const optionPosition = position("OPTION");
  const underlyingPosition = position("UNDERLYING");
  const ledgerCash = sum(ledger.map(fill => -fill.quantity * fill.price * fill.multiplier - fill.fee));
  const error = ledgerCash - reportedNetPnl;
  return {
    optionPosition,
    underlyingPosition,
    ledgerCash,
    error,
    reconciled: Number.isFinite(reportedNetPnl)
      && Number.isFinite(error)
      && optionPosition === 0
      && underlyingPosition === 0
      && Math.abs(error) <= RECONCILIATION_TOLERANCE,
  };
}

function hedgeExecutionPrice(spot: number, quantity: number, halfSpreadBps: number, impactBpsPerHundred: number) {
  const direction = Math.sign(quantity);
  const impactBps = impactBpsPerHundred * Math.abs(quantity) / 100;
  return spot * (1 + direction * (halfSpreadBps + impactBps) / 10_000);
}

export function simulatePolicy(scenario: Scenario, policy: PolicyKind): SimulationResult {
  const { config, option } = scenario;
  const filter = new DirectionalToxicityFilter();
  const quoteHistory: Quote[] = [];
  const hedgeOrders: HedgeOrder[] = [];
  const records: StepRecord[] = [];
  const ledger: LedgerFill[] = [];
  const hedged = policy !== "BASELINE";

  let optionInventory = 0;
  let underlyingInventory = 0;
  let optionTradeCash = 0;
  let hedgeTradeCash = 0;
  let optionFees = 0;
  let hedgeFees = 0;
  let liquidationCost = 0;
  let optionFills = 0;
  let customerVolume = 0;
  let maxAbsOptionInventory = 0;
  let maxAbsDelta = 0;
  let maxAbsGamma = 0;
  let maxAbsVega = 0;
  const fullSpreads: number[] = [];

  for (let time = 0; time < config.steps; time += 1) {
    const state = scenario.states[time];
    const nextState = scenario.states[time + 1];
    const event = scenario.events[time];

    const executing = hedgeOrders.filter(order => order.executeAt === time);
    for (const order of executing) {
      const executionPrice = hedgeExecutionPrice(
        state.spot,
        order.quantity,
        config.underlyingHalfSpreadBps,
        config.hedgeImpactBpsPerHundredShares,
      );
      const fee = Math.abs(order.quantity) * config.hedgeFeePerShare;
      hedgeTradeCash -= order.quantity * executionPrice;
      underlyingInventory += order.quantity;
      hedgeFees += fee;
      ledger.push({ time, instrument: "UNDERLYING", kind: "HEDGE", quantity: order.quantity, price: executionPrice, multiplier: 1, fee });
    }

    const posterior = filter.posterior();
    const quote = makeQuote({
      time,
      spot: state.spot,
      volatility: state.volatility,
      optionInventory,
      posterior,
      policy,
      config,
      option,
    });
    quoteHistory.push(quote);
    if (quote.bid !== null && quote.ask !== null) fullSpreads.push(quote.ask - quote.bid);

    const activeQuote = [...quoteHistory].reverse().find(candidate => candidate.activeTime <= time);
    const analytics = optionAnalytics({ time, spot: state.spot, volatility: state.volatility, config, option });
    let optionFill = 0;
    let optionFillPrice: number | null = null;

    if (event.side !== null) {
      customerVolume += event.marketOrderSize;
      const availableAfterQueue = Math.max(0, event.marketOrderSize - event.queueAhead);
      const quantity = Math.min(config.optionOrderSize, availableAfterQueue);
      if (activeQuote && quantity > 0 && event.side === "BUY" && activeQuote.ask !== null) {
        const customerLimit = analytics.call + event.reservationDistance;
        if (activeQuote.ask <= customerLimit) {
          optionFill = -quantity;
          optionFillPrice = activeQuote.ask;
        }
      }
      if (activeQuote && quantity > 0 && event.side === "SELL" && activeQuote.bid !== null) {
        const customerLimit = analytics.call - event.reservationDistance;
        if (activeQuote.bid >= customerLimit) {
          optionFill = quantity;
          optionFillPrice = activeQuote.bid;
        }
      }
    }

    if (optionFill !== 0 && optionFillPrice !== null) {
      const fee = Math.abs(optionFill) * config.optionFeePerContract;
      optionInventory += optionFill;
      optionTradeCash -= optionFill * optionFillPrice * option.multiplier;
      optionFees += fee;
      optionFills += Math.abs(optionFill);
      ledger.push({ time, instrument: "OPTION", kind: "CUSTOMER", quantity: optionFill, price: optionFillPrice, multiplier: option.multiplier, fee });
    }

    const pendingHedgeQuantity = sum(hedgeOrders.filter(order => order.executeAt > time).map(order => order.quantity));
    if (hedged) {
      const targetUnderlyingInventory = -Math.round(optionInventory * analytics.delta * option.multiplier);
      const requiredTrade = targetUnderlyingInventory - underlyingInventory - pendingHedgeQuantity;
      if (Math.abs(requiredTrade) >= config.hedgeThresholdShares) {
        hedgeOrders.push({ submittedAt: time, executeAt: time + config.hedgeLatencySteps, quantity: requiredTrade });
      }
    }

    const deltaExposure = optionInventory * analytics.delta * option.multiplier + underlyingInventory;
    const gammaExposure = optionInventory * analytics.gamma * option.multiplier;
    const vegaExposure = optionInventory * analytics.vega * option.multiplier;
    maxAbsOptionInventory = Math.max(maxAbsOptionInventory, Math.abs(optionInventory));
    maxAbsDelta = Math.max(maxAbsDelta, Math.abs(deltaExposure));
    maxAbsGamma = Math.max(maxAbsGamma, Math.abs(gammaExposure));
    maxAbsVega = Math.max(maxAbsVega, Math.abs(vegaExposure));

    records.push({
      time,
      spot: state.spot,
      volatility: state.volatility,
      fairValue: analytics.call,
      optionInventory,
      underlyingInventory,
      optionFill,
      optionFillPrice,
      customerSide: event.side,
      queueAhead: event.queueAhead,
      quote,
      posterior,
      deltaExposure,
      gammaExposure,
      vegaExposure,
      cash: optionTradeCash + hedgeTradeCash - optionFees - hedgeFees,
    });

    const observedReturn = (nextState.spot - state.spot) / state.spot;
    filter.update({ side: event.side, imbalance: event.imbalance, observedReturn });
  }

  const terminalState = scenario.states.at(-1)!;
  const terminalAnalytics = optionAnalytics({
    time: config.steps,
    spot: terminalState.spot,
    volatility: terminalState.volatility,
    config,
    option,
  });

  if (optionInventory !== 0) {
    const midCash = optionInventory * terminalAnalytics.call * option.multiplier;
    // A long option worth less than the half-spread has no bid above zero; it cannot sell for a tick above value.
    const actualPrice = optionInventory > 0
      ? Math.max(0, terminalAnalytics.call - config.terminalOptionHalfSpread)
      : terminalAnalytics.call + config.terminalOptionHalfSpread;
    const actualCash = optionInventory * actualPrice * option.multiplier;
    const fee = Math.abs(optionInventory) * config.optionFeePerContract;
    optionTradeCash += midCash;
    liquidationCost += midCash - actualCash;
    optionFees += fee;
    ledger.push({ time: config.steps, instrument: "OPTION", kind: "LIQUIDATION", quantity: -optionInventory, price: actualPrice, multiplier: option.multiplier, fee });
    optionInventory = 0;
  }

  if (underlyingInventory !== 0) {
    const closeQuantity = -underlyingInventory;
    const midCash = -closeQuantity * terminalState.spot;
    const actualPrice = hedgeExecutionPrice(
      terminalState.spot,
      closeQuantity,
      config.underlyingHalfSpreadBps,
      config.hedgeImpactBpsPerHundredShares,
    );
    const actualCash = -closeQuantity * actualPrice;
    const fee = Math.abs(closeQuantity) * config.hedgeFeePerShare;
    hedgeTradeCash += midCash;
    liquidationCost += Math.max(0, midCash - actualCash);
    hedgeFees += fee;
    ledger.push({ time: config.steps, instrument: "UNDERLYING", kind: "LIQUIDATION", quantity: closeQuantity, price: actualPrice, multiplier: 1, fee });
    underlyingInventory = 0;
  }

  const netPnl = optionTradeCash + hedgeTradeCash - optionFees - hedgeFees - liquidationCost;
  const reconciliation = reconcileLedger(ledger, netPnl);

  return {
    seed: scenario.seed,
    policy,
    netPnl,
    optionTradeCash,
    hedgeTradeCash,
    optionFees,
    hedgeFees,
    liquidationCost,
    optionFills,
    fillRate: customerVolume > 0 ? optionFills / customerVolume : 0,
    maxAbsOptionInventory,
    maxAbsDelta,
    maxAbsGamma,
    maxAbsVega,
    meanFullSpread: fullSpreads.length ? sum(fullSpreads) / fullSpreads.length : 0,
    finalOptionInventory: reconciliation.optionPosition,
    finalUnderlyingInventory: reconciliation.underlyingPosition,
    reconciliationError: reconciliation.error,
    reconciled: reconciliation.reconciled,
    ledger,
    records,
  };
}
