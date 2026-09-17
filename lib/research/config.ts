import type { OptionSpec, ResearchConfig } from "./types.ts";

export const defaultOptionSpec: OptionSpec = {
  strike: 100,
  expiryYears: 30 / 365,
  multiplier: 100,
};

export const defaultResearchConfig: ResearchConfig = {
  steps: 120,
  dtYears: 1 / (252 * 390),
  initialSpot: 100,
  initialVolatility: 0.22,
  longRunVolatility: 0.22,
  volatilityMeanReversion: 8,
  volatilityOfVolatility: 0.35,
  rate: 0.05,
  dividend: 0,
  physicalDrift: 0.08,
  informedProbability: 0.18,
  regimePersistence: 0.82,
  informedReturnSignal: 0.45,
  informedVolatilitySignal: 0.08,
  arrivalProbability: 0.42,
  distanceSensitivity: 4.2,
  informedSideAccuracy: 0.82,
  meanQueueAhead: 1.4,
  meanMarketOrderSize: 2.1,
  optionTickSize: 0.01,
  optionOrderSize: 1,
  optionFeePerContract: 0.25,
  quoteLatencySteps: 1,
  underlyingHalfSpreadBps: 0.6,
  hedgeFeePerShare: 0.005,
  hedgeLatencySteps: 1,
  hedgeImpactBpsPerHundredShares: 0.35,
  terminalOptionHalfSpread: 0.08,
  maxOptionInventory: 12,
  baseOptionHalfSpread: 0.12,
  riskAversion: 0.12,
  toxicityPremium: 0.24,
  hedgeThresholdShares: 12,
};

export function validateResearchConfig(config: ResearchConfig, option: OptionSpec) {
  const finite = Object.entries(config).filter(([, value]) => typeof value === "number" && !Number.isFinite(value));
  if (finite.length) throw new RangeError(`Non-finite research parameters: ${finite.map(([key]) => key).join(", ")}`);
  if (!Number.isInteger(config.steps) || config.steps < 2) throw new RangeError("steps must be an integer of at least 2");
  if (!(config.dtYears > 0)) throw new RangeError("dtYears must be positive");
  if (!(config.initialSpot > 0)) throw new RangeError("initialSpot must be positive");
  if (!(config.initialVolatility > 0 && config.longRunVolatility > 0)) throw new RangeError("volatility inputs must be positive");
  for (const key of ["informedProbability", "regimePersistence", "informedSideAccuracy", "arrivalProbability"] as const) {
    if (config[key] < 0 || config[key] > 1) throw new RangeError(`${key} must be in [0, 1]`);
  }
  if (!(config.distanceSensitivity > 0)) throw new RangeError("distanceSensitivity must be positive");
  if (!(config.optionTickSize > 0)) throw new RangeError("optionTickSize must be positive");
  if (!Number.isInteger(config.optionOrderSize) || config.optionOrderSize < 1) throw new RangeError("optionOrderSize must be a positive integer");
  if (!Number.isInteger(config.maxOptionInventory) || config.maxOptionInventory < config.optionOrderSize) throw new RangeError("maxOptionInventory is invalid");
  if (!(option.strike > 0 && option.expiryYears > config.dtYears && option.multiplier > 0)) throw new RangeError("option specification is invalid");
}
