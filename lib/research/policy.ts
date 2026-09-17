import { bs } from "../quant.ts";
import type { OptionSpec, PolicyKind, Quote, ResearchConfig, ToxicityPosterior } from "./types.ts";

const roundDown = (value: number, tick: number) => Math.floor((value + 1e-12) / tick) * tick;
const roundUp = (value: number, tick: number) => Math.ceil((value - 1e-12) / tick) * tick;

export type QuoteContext = {
  time: number;
  spot: number;
  volatility: number;
  optionInventory: number;
  posterior: ToxicityPosterior;
  policy: PolicyKind;
  config: ResearchConfig;
  option: OptionSpec;
};

export function optionAnalytics(context: Omit<QuoteContext, "policy" | "posterior" | "optionInventory">) {
  const elapsed = context.time * context.config.dtYears;
  const maturity = Math.max(context.option.expiryYears - elapsed, 1 / (252 * 390));
  return bs({
    spot: context.spot,
    strike: context.option.strike,
    maturity,
    vol: context.volatility,
    rate: context.config.rate,
    dividend: context.config.dividend,
    paths: 100,
    seed: 0,
  });
}

export function makeQuote(context: QuoteContext): Quote {
  const analytics = optionAnalytics(context);
  const adaptive = context.policy === "INVENTORY_TOXICITY_AWARE";
  const oneStepDeltaVariance = (analytics.delta * context.spot * context.volatility * Math.sqrt(context.config.dtYears)) ** 2;
  const oneStepGammaVariance = 0.5 * (
    analytics.gamma * context.spot ** 2 * context.volatility ** 2 * context.config.dtYears
  ) ** 2;
  const optionVariance = oneStepDeltaVariance + oneStepGammaVariance;
  const inventoryShift = adaptive
    ? context.config.riskAversion * context.optionInventory * optionVariance
    : 0;
  const reservationPrice = Math.max(context.config.optionTickSize, analytics.call - inventoryShift);
  const bidToxicityPremium = adaptive ? context.config.toxicityPremium * context.posterior.informedSell : 0;
  const askToxicityPremium = adaptive ? context.config.toxicityPremium * context.posterior.informedBuy : 0;
  const rawBid = reservationPrice - context.config.baseOptionHalfSpread - bidToxicityPremium;
  const rawAsk = reservationPrice + context.config.baseOptionHalfSpread + askToxicityPremium;
  const bid = context.optionInventory + context.config.optionOrderSize <= context.config.maxOptionInventory
    ? Math.max(context.config.optionTickSize, roundDown(rawBid, context.config.optionTickSize))
    : null;
  const ask = context.optionInventory - context.config.optionOrderSize >= -context.config.maxOptionInventory
    ? Math.max(context.config.optionTickSize, roundUp(rawAsk, context.config.optionTickSize))
    : null;

  return {
    decisionTime: context.time,
    activeTime: context.time + context.config.quoteLatencySteps,
    bid,
    ask,
    fairValue: analytics.call,
    reservationPrice,
    bidDistance: bid === null ? null : analytics.call - bid,
    askDistance: ask === null ? null : ask - analytics.call,
    posterior: { ...context.posterior },
  };
}
