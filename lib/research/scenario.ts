import { SeededRandom } from "./random.ts";
import { validateResearchConfig } from "./config.ts";
import type { LatentRegime, OptionSpec, ResearchConfig, Scenario } from "./types.ts";

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

function nextRegime(previous: LatentRegime, random: SeededRandom, config: ResearchConfig): LatentRegime {
  if (previous !== 0 && random.uniform() < config.regimePersistence) return previous;
  if (random.uniform() >= config.informedProbability) return 0;
  return random.uniform() < 0.5 ? -1 : 1;
}

export function generateScenario(seed: number, config: ResearchConfig, option: OptionSpec): Scenario {
  validateResearchConfig(config, option);
  const random = new SeededRandom(seed);
  const states = [{ time: 0, spot: config.initialSpot, volatility: config.initialVolatility, regime: 0 as LatentRegime }];
  const events = [];

  for (let time = 0; time < config.steps; time += 1) {
    const current = states[time];
    const regime = nextRegime(current.regime, random, config);
    const hasCustomer = random.uniform() < config.arrivalProbability;
    const informedBuyProbability = regime === 1
      ? config.informedSideAccuracy
      : regime === -1
        ? 1 - config.informedSideAccuracy
        : 0.5;
    const side = hasCustomer ? (random.uniform() < informedBuyProbability ? "BUY" as const : "SELL" as const) : null;
    const reservationDistance = hasCustomer ? random.exponential(config.distanceSensitivity) : 0;
    const marketOrderSize = hasCustomer ? Math.max(1, random.poisson(config.meanMarketOrderSize)) : 0;
    const queueAhead = hasCustomer ? random.poisson(config.meanQueueAhead) : 0;
    const imbalanceNoise = random.normal() * 0.3;
    const imbalance = clamp((regime * 0.55) + imbalanceNoise, -1, 1);

    events.push({ time, side, reservationDistance, marketOrderSize, queueAhead, imbalance, regime });

    const volatilityShock = config.volatilityOfVolatility * current.volatility * Math.sqrt(config.dtYears) * random.normal();
    const informedVolatilityJump = regime === 0 ? 0 : config.informedVolatilitySignal * current.volatility * config.dtYears;
    const nextVolatility = clamp(
      current.volatility
        + config.volatilityMeanReversion * (config.longRunVolatility - current.volatility) * config.dtYears
        + volatilityShock
        + informedVolatilityJump,
      0.04,
      1.5,
    );
    const returnShock = random.normal() + regime * config.informedReturnSignal;
    const logReturn = (config.physicalDrift - config.dividend - 0.5 * current.volatility ** 2) * config.dtYears
      + current.volatility * Math.sqrt(config.dtYears) * returnShock;
    const nextSpot = current.spot * Math.exp(logReturn);
    states.push({ time: time + 1, spot: nextSpot, volatility: nextVolatility, regime });
  }

  return { seed, states, events, config, option };
}
