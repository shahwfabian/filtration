import { defaultOptionSpec, defaultResearchConfig } from "./config.ts";
import { pairedBootstrapComparison, runResearchPanel, type ResearchPanel } from "./evaluate.ts";
import type { OptionSpec, ResearchConfig, SimulationResult } from "./types.ts";

export type AttributionStep = {
  id: "HEDGING" | "ADAPTIVE_QUOTING" | "INVENTORY_SKEW" | "BEYOND_SPREAD_WIDTH";
  question: string;
  candidate: string;
  benchmark: string;
  candidateMeanNetPnl: number;
  benchmarkMeanNetPnl: number;
  observedMeanDifference: number;
  confidenceInterval: [number, number];
  probabilityOfImprovement: number;
  resamples: number;
};

const mean = (rows: SimulationResult[]) => rows.reduce((total, row) => total + row.netPnl, 0) / rows.length;

// Exploratory decomposition of the adaptive policy's improvement. It is run on development seeds only;
// it compares fixed variants and does not select or tune a policy.
export function attributionDiagnostic(
  seeds: number[],
  config: ResearchConfig = defaultResearchConfig,
  option: OptionSpec = defaultOptionSpec,
) {
  const reference = runResearchPanel(seeds, config, option);
  const adaptive = reference.summaries.find(summary => summary.policy === "INVENTORY_TOXICITY_AWARE")!;
  const matchedHalfSpread = Math.round(adaptive.meanFullSpread / 2 / config.optionTickSize) * config.optionTickSize;
  const withoutSkew = runResearchPanel(seeds, { ...config, riskAversion: 0 }, option);
  const widthMatched = runResearchPanel(seeds, { ...config, baseOptionHalfSpread: matchedHalfSpread }, option);

  const step = (
    id: AttributionStep["id"],
    question: string,
    candidate: [string, SimulationResult[]],
    benchmark: [string, SimulationResult[]],
  ): AttributionStep => {
    const panel: ResearchPanel = {
      seeds: reference.seeds,
      summaries: [],
      rows: { BASELINE: benchmark[1], DELTA_HEDGED: [], INVENTORY_TOXICITY_AWARE: candidate[1] },
    };
    const comparison = pairedBootstrapComparison(panel, "INVENTORY_TOXICITY_AWARE", "BASELINE");
    return {
      id,
      question,
      candidate: candidate[0],
      benchmark: benchmark[0],
      candidateMeanNetPnl: mean(candidate[1]),
      benchmarkMeanNetPnl: mean(benchmark[1]),
      observedMeanDifference: comparison.observedMeanDifference,
      confidenceInterval: comparison.confidenceInterval,
      probabilityOfImprovement: comparison.probabilityOfImprovement,
      resamples: comparison.resamples,
    };
  };

  return {
    split: "train" as const,
    seeds: seeds.length,
    exploratory: true,
    matchedHalfSpread,
    steps: [
      step("HEDGING", "What does frictional delta hedging add to symmetric quoting?",
        ["Symmetric delta-hedged", reference.rows.DELTA_HEDGED], ["Symmetric unhedged", reference.rows.BASELINE]),
      step("ADAPTIVE_QUOTING", "What do inventory skew and toxicity premiums add to a hedged book?",
        ["Inventory + toxicity aware", reference.rows.INVENTORY_TOXICITY_AWARE], ["Symmetric delta-hedged", reference.rows.DELTA_HEDGED]),
      step("INVENTORY_SKEW", "What does the inventory skew add on its own?",
        ["Inventory + toxicity aware", reference.rows.INVENTORY_TOXICITY_AWARE], ["Same policy, no inventory skew", withoutSkew.rows.INVENTORY_TOXICITY_AWARE]),
      step("BEYOND_SPREAD_WIDTH", "Does directional quoting beat a symmetric hedged quote of the same average width?",
        ["Inventory + toxicity aware", reference.rows.INVENTORY_TOXICITY_AWARE], [`Symmetric delta-hedged, ±$${matchedHalfSpread.toFixed(2)}`, widthMatched.rows.DELTA_HEDGED]),
    ],
  };
}
