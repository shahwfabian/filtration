export type CustomerSide = "BUY" | "SELL";
export type LatentRegime = -1 | 0 | 1;
export type PolicyKind = "BASELINE" | "DELTA_HEDGED" | "INVENTORY_TOXICITY_AWARE";

export type OptionSpec = {
  strike: number;
  expiryYears: number;
  multiplier: number;
};

export type ResearchConfig = {
  steps: number;
  dtYears: number;
  initialSpot: number;
  initialVolatility: number;
  longRunVolatility: number;
  volatilityMeanReversion: number;
  volatilityOfVolatility: number;
  rate: number;
  dividend: number;
  physicalDrift: number;
  informedProbability: number;
  regimePersistence: number;
  informedReturnSignal: number;
  informedVolatilitySignal: number;
  arrivalProbability: number;
  distanceSensitivity: number;
  informedSideAccuracy: number;
  meanQueueAhead: number;
  meanMarketOrderSize: number;
  optionTickSize: number;
  optionOrderSize: number;
  optionFeePerContract: number;
  quoteLatencySteps: number;
  underlyingHalfSpreadBps: number;
  hedgeFeePerShare: number;
  hedgeLatencySteps: number;
  hedgeImpactBpsPerHundredShares: number;
  terminalOptionHalfSpread: number;
  maxOptionInventory: number;
  baseOptionHalfSpread: number;
  riskAversion: number;
  toxicityPremium: number;
  hedgeThresholdShares: number;
};

export type MarketState = {
  time: number;
  spot: number;
  volatility: number;
  regime: LatentRegime;
};

export type LatentCustomerEvent = {
  time: number;
  side: CustomerSide | null;
  reservationDistance: number;
  marketOrderSize: number;
  queueAhead: number;
  imbalance: number;
  regime: LatentRegime;
};

export type Scenario = {
  seed: number;
  states: MarketState[];
  events: LatentCustomerEvent[];
  config: ResearchConfig;
  option: OptionSpec;
};

export type ToxicityPosterior = {
  informedSell: number;
  uninformed: number;
  informedBuy: number;
};

export type Quote = {
  decisionTime: number;
  activeTime: number;
  bid: number | null;
  ask: number | null;
  fairValue: number;
  reservationPrice: number;
  bidDistance: number | null;
  askDistance: number | null;
  posterior: ToxicityPosterior;
};

export type HedgeOrder = {
  submittedAt: number;
  executeAt: number;
  quantity: number;
};

export type StepRecord = {
  time: number;
  spot: number;
  volatility: number;
  fairValue: number;
  optionInventory: number;
  underlyingInventory: number;
  optionFill: number;
  optionFillPrice: number | null;
  customerSide: CustomerSide | null;
  queueAhead: number;
  quote: Quote;
  posterior: ToxicityPosterior;
  deltaExposure: number;
  gammaExposure: number;
  vegaExposure: number;
  cash: number;
};

export type LedgerFill = {
  time: number;
  instrument: "OPTION" | "UNDERLYING";
  kind: "CUSTOMER" | "HEDGE" | "LIQUIDATION";
  quantity: number;
  price: number;
  multiplier: number;
  fee: number;
};

export type SimulationResult = {
  seed: number;
  policy: PolicyKind;
  netPnl: number;
  optionTradeCash: number;
  hedgeTradeCash: number;
  optionFees: number;
  hedgeFees: number;
  liquidationCost: number;
  optionFills: number;
  fillRate: number;
  maxAbsOptionInventory: number;
  maxAbsDelta: number;
  maxAbsGamma: number;
  maxAbsVega: number;
  meanFullSpread: number;
  finalOptionInventory: number;
  finalUnderlyingInventory: number;
  reconciliationError: number;
  reconciled: boolean;
  ledger: LedgerFill[];
  records: StepRecord[];
};

