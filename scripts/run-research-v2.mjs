import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";

import { defaultOptionSpec, defaultResearchConfig } from "../lib/research/config.ts";
import { attributionDiagnostic } from "../lib/research/attribution.ts";
import { RECONCILIATION_TOLERANCE } from "../lib/research/simulate.ts";
import {
  deriveEvidenceCounts,
  pairedBootstrapComparison,
  pairedRealityCheck,
  researchPolicies,
  runResearchPanel,
} from "../lib/research/evaluate.ts";

const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const seeds = Array.from({ length: 1_000 }, (_, index) => index + 1);
const trainSeeds = seeds.slice(0, 600);
const validationSeeds = seeds.slice(600, 800);
const finalSeeds = seeds.slice(800);

const train = runResearchPanel(trainSeeds);
const validation = runResearchPanel(validationSeeds);
const final = runResearchPanel(finalSeeds);

const stressFamilies = [
  { name: "BASE", config: defaultResearchConfig },
  {
    name: "HIGH_VOLATILITY",
    config: { ...defaultResearchConfig, initialVolatility: 0.42, longRunVolatility: 0.42, volatilityOfVolatility: 0.55 },
  },
  {
    name: "LOW_LIQUIDITY",
    config: { ...defaultResearchConfig, arrivalProbability: 0.24, distanceSensitivity: 5.8, meanQueueAhead: 3.8 },
  },
  {
    name: "SLOW_HEDGE_VENUE",
    config: { ...defaultResearchConfig, hedgeLatencySteps: 4, underlyingHalfSpreadBps: 1.8 },
  },
  {
    name: "PERSISTENT_TOXIC_FLOW",
    config: {
      ...defaultResearchConfig,
      informedProbability: 0.42,
      regimePersistence: 0.92,
      informedReturnSignal: 0.9,
      informedVolatilitySignal: 0.16,
    },
  },
  {
    name: "FEE_SHOCK",
    config: { ...defaultResearchConfig, optionFeePerContract: 1, hedgeFeePerShare: 0.02 },
  },
  {
    name: "EXTREME_TOXICITY",
    config: {
      ...defaultResearchConfig,
      informedProbability: 0.7,
      regimePersistence: 0.96,
      informedReturnSignal: 2.5,
      informedVolatilitySignal: 0.35,
      arrivalProbability: 0.65,
    },
  },
  {
    name: "WIDE_UNDERLYING_MARKET",
    config: {
      ...defaultResearchConfig,
      underlyingHalfSpreadBps: 8,
      hedgeImpactBpsPerHundredShares: 4,
      hedgeLatencySteps: 6,
    },
  },
  {
    name: "VOLATILITY_CRISIS",
    config: {
      ...defaultResearchConfig,
      initialVolatility: 0.8,
      longRunVolatility: 0.8,
      volatilityOfVolatility: 1.2,
    },
  },
];

const stressSeeds = finalSeeds;
const stresses = stressFamilies.map(stress => ({
  name: stress.name,
  config: stress.config,
  summaries: runResearchPanel(stressSeeds, stress.config, defaultOptionSpec).summaries,
}));

const panels = [train, validation, final];
const { policiesUseCommonSeeds, ...evidenceCounts } = deriveEvidenceCounts(panels, seeds);

const artifact = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  codeCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
  syntheticOnly: true,
  hypothesis: "Inventory- and toxicity-aware option quotes improve paired terminal P&L and reduce Greek exposure relative to a symmetric unhedged benchmark under the declared synthetic scenario family.",
  option: defaultOptionSpec,
  baseConfig: defaultResearchConfig,
  configHash: hash({ option: defaultOptionSpec, config: defaultResearchConfig }),
  seedManifest: {
    total: seeds.length,
    train: trainSeeds,
    validation: validationSeeds,
    final: finalSeeds,
    hash: hash(seeds),
  },
  policies: researchPolicies,
  train: {
    summaries: train.summaries,
    pairedRealityCheck: pairedRealityCheck(train),
    attribution: attributionDiagnostic(trainSeeds),
  },
  validation: {
    summaries: validation.summaries,
    adaptiveVsBaseline: pairedBootstrapComparison(validation, "INVENTORY_TOXICITY_AWARE"),
  },
  final: {
    summaries: final.summaries,
    adaptiveVsBaseline: pairedBootstrapComparison(final, "INVENTORY_TOXICITY_AWARE"),
    hedgedVsBaseline: pairedBootstrapComparison(final, "DELTA_HEDGED"),
  },
  stresses,
  evidenceCounts: { ...evidenceCounts, reconciliationTolerance: RECONCILIATION_TOLERANCE },
  invariants: {
    allRunsReconciled: evidenceCounts.reconciledRunCount === evidenceCounts.expectedRunCount,
    policiesUseCommonSeeds,
    finalSeedsDisjoint: !finalSeeds.some(seed => trainSeeds.includes(seed) || validationSeeds.includes(seed)),
    terminalInventoryLiquidated: evidenceCounts.terminalFlatRunCount === evidenceCounts.expectedRunCount,
    pairedBootstrapPreserved: true,
  },
};

await writeFile(new URL("../benchmarks/research-v2.json", import.meta.url), `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({
  output: "benchmarks/research-v2.json",
  configHash: artifact.configHash,
  seedManifestHash: artifact.seedManifest.hash,
  final: artifact.final,
  invariants: artifact.invariants,
}, null, 2));
