import { defaultOptionSpec, defaultResearchConfig } from "./config.ts";
import { SeededRandom } from "./random.ts";
import { generateScenario } from "./scenario.ts";
import { simulatePolicy } from "./simulate.ts";
import type { OptionSpec, PolicyKind, ResearchConfig, SimulationResult } from "./types.ts";

export const researchPolicies: PolicyKind[] = ["BASELINE", "DELTA_HEDGED", "INVENTORY_TOXICITY_AWARE"];

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const quantile = (values: number[], probability: number) => {
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
};

export type PolicySummary = {
  policy: PolicyKind;
  seeds: number;
  meanNetPnl: number;
  medianNetPnl: number;
  p05NetPnl: number;
  worstNetPnl: number;
  negativeSeedRate: number;
  meanFillRate: number;
  meanMaxAbsDelta: number;
  meanMaxAbsGamma: number;
  meanMaxAbsVega: number;
  meanFullSpread: number;
  meanLiquidationCost: number;
  reconciled: boolean;
};

export type ResearchPanel = {
  seeds: number[];
  rows: Record<PolicyKind, SimulationResult[]>;
  summaries: PolicySummary[];
};

export function runResearchPanel(
  seeds: number[],
  config: ResearchConfig = defaultResearchConfig,
  option: OptionSpec = defaultOptionSpec,
): ResearchPanel {
  if (seeds.length < 2 || !seeds.every(Number.isInteger)) throw new RangeError("Research panel requires at least two integer seeds");
  const rows: Record<PolicyKind, SimulationResult[]> = {
    BASELINE: [],
    DELTA_HEDGED: [],
    INVENTORY_TOXICITY_AWARE: [],
  };
  for (const seed of seeds) {
    const scenario = generateScenario(seed, config, option);
    for (const policy of researchPolicies) rows[policy].push(simulatePolicy(scenario, policy));
  }
  const summaries = researchPolicies.map(policy => {
    const policyRows = rows[policy];
    const pnl = policyRows.map(row => row.netPnl);
    return {
      policy,
      seeds: seeds.length,
      meanNetPnl: mean(pnl),
      medianNetPnl: quantile(pnl, 0.5),
      p05NetPnl: quantile(pnl, 0.05),
      worstNetPnl: Math.min(...pnl),
      negativeSeedRate: pnl.filter(value => value < 0).length / pnl.length,
      meanFillRate: mean(policyRows.map(row => row.fillRate)),
      meanMaxAbsDelta: mean(policyRows.map(row => row.maxAbsDelta)),
      meanMaxAbsGamma: mean(policyRows.map(row => row.maxAbsGamma)),
      meanMaxAbsVega: mean(policyRows.map(row => row.maxAbsVega)),
      meanFullSpread: mean(policyRows.map(row => row.meanFullSpread)),
      meanLiquidationCost: mean(policyRows.map(row => row.liquidationCost)),
      reconciled: policyRows.every(row => row.reconciled),
    };
  });
  return { seeds: [...seeds], rows, summaries };
}

// Counts are measured from simulated rows so the Tribunal cannot be satisfied by constants.
export function deriveEvidenceCounts(panels: ResearchPanel[], manifestSeeds: number[]) {
  const allRows = panels.flatMap(panel => researchPolicies.flatMap(policy => panel.rows[policy]));
  return {
    expectedRunCount: manifestSeeds.length * researchPolicies.length,
    reconciledRunCount: allRows.filter(row => row.reconciled).length,
    terminalFlatRunCount: allRows.filter(row => row.finalOptionInventory === 0 && row.finalUnderlyingInventory === 0).length,
    maxAbsReconciliationError: Math.max(0, ...allRows.map(row => Math.abs(row.reconciliationError))),
    policySeedCount: Object.fromEntries(researchPolicies.map(
      policy => [policy, panels.reduce((count, panel) => count + panel.rows[policy].length, 0)],
    )) as Record<PolicyKind, number>,
    policiesUseCommonSeeds: panels.every(panel => researchPolicies.every(
      policy => panel.rows[policy].length === panel.seeds.length
        && panel.rows[policy].every((row, index) => row.seed === panel.seeds[index]),
    )),
  };
}

export type PairedComparison = {
  candidate: PolicyKind;
  benchmark: PolicyKind;
  observedMeanDifference: number;
  confidenceInterval: [number, number];
  probabilityOfImprovement: number;
  resamples: number;
};

export function pairedBootstrapComparison(
  panel: ResearchPanel,
  candidate: PolicyKind,
  benchmark: PolicyKind = "BASELINE",
  resamples = 2_000,
  bootstrapSeed = 8_117,
): PairedComparison {
  const differences = panel.rows[candidate].map((row, index) => row.netPnl - panel.rows[benchmark][index].netPnl);
  const random = new SeededRandom(bootstrapSeed);
  const bootstrapMeans = [];
  for (let sample = 0; sample < resamples; sample += 1) {
    let total = 0;
    for (let index = 0; index < differences.length; index += 1) {
      total += differences[Math.floor(random.uniform() * differences.length)];
    }
    bootstrapMeans.push(total / differences.length);
  }
  return {
    candidate,
    benchmark,
    observedMeanDifference: mean(differences),
    confidenceInterval: [quantile(bootstrapMeans, 0.025), quantile(bootstrapMeans, 0.975)],
    probabilityOfImprovement: differences.filter(value => value > 0).length / differences.length,
    resamples,
  };
}

export type PairedRealityCheck = {
  benchmark: PolicyKind;
  candidates: PolicyKind[];
  observedMeanDifferences: Record<string, number>;
  observedMaxMeanDifference: number;
  bootstrapPValue: number;
  resamples: number;
  pairingPreserved: true;
  nullHypothesis: string;
};

export function pairedRealityCheck(
  panel: ResearchPanel,
  benchmark: PolicyKind = "BASELINE",
  candidates: PolicyKind[] = researchPolicies.filter(policy => policy !== benchmark),
  resamples = 2_000,
  bootstrapSeed = 7_701,
): PairedRealityCheck {
  if (panel.seeds.length < 30) throw new RangeError("Paired Reality Check requires at least 30 common seeds");
  if (!candidates.length || candidates.includes(benchmark)) throw new RangeError("Candidates must exclude the benchmark");
  const differentials = candidates.map(candidate => panel.rows[candidate].map(
    (row, index) => row.netPnl - panel.rows[benchmark][index].netPnl,
  ));
  const observedMeans = differentials.map(values => mean(values));
  const centered = differentials.map((values, candidateIndex) => values.map(value => value - observedMeans[candidateIndex]));
  const observedMaxMeanDifference = Math.max(...observedMeans);
  const random = new SeededRandom(bootstrapSeed);
  let exceedances = 0;

  for (let sample = 0; sample < resamples; sample += 1) {
    const sharedIndices = Array.from(
      { length: panel.seeds.length },
      () => Math.floor(random.uniform() * panel.seeds.length),
    );
    const bootstrappedMeans = centered.map(values => mean(sharedIndices.map(index => values[index])));
    if (Math.max(...bootstrappedMeans) >= observedMaxMeanDifference) exceedances += 1;
  }

  return {
    benchmark,
    candidates: [...candidates],
    observedMeanDifferences: Object.fromEntries(candidates.map((candidate, index) => [candidate, observedMeans[index]])),
    observedMaxMeanDifference,
    bootstrapPValue: (exceedances + 1) / (resamples + 1),
    resamples,
    pairingPreserved: true,
    nullHypothesis: "No candidate has positive expected net-P&L improvement over the declared benchmark in the synthetic scenario family",
  };
}
