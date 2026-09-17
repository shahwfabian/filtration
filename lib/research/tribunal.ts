import { createHash } from "node:crypto";

export type Finding = {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";
  title: string;
  evidence: string;
  remediation: string;
};

type EvidenceArtifact = {
  syntheticOnly: boolean;
  option: Record<string, number>;
  baseConfig: Record<string, number>;
  configHash: string;
  seedManifest: { total: number; train: number[]; validation: number[]; final: number[]; hash: string };
  train?: {
    attribution?: { seeds: number; steps: Array<{ id: string; observedMeanDifference: number; confidenceInterval: number[] }> };
  };
  final: {
    summaries: Array<{ policy: string; negativeSeedRate: number; reconciled: boolean }>;
    adaptiveVsBaseline: { confidenceInterval: number[]; probabilityOfImprovement: number };
  };
  stresses: Array<{ name: string; summaries: Array<{ policy: string; negativeSeedRate: number; p05NetPnl: number }> }>;
  evidenceCounts: { expectedRunCount: number; reconciledRunCount: number; terminalFlatRunCount: number; policySeedCount: Record<string, number> };
};

const weights = { CRITICAL: 30, HIGH: 15, MEDIUM: 8, INFO: 2 } as const;

export function adjudicate(artifact: EvidenceArtifact) {
  const findings: Finding[] = [];
  const add = (finding: Finding) => findings.push(finding);
  const seedSets = [artifact.seedManifest.train, artifact.seedManifest.validation, artifact.seedManifest.final];
  const allSeeds = seedSets.flat();
  const uniqueSeeds = new Set(allSeeds);
  const seedHash = createHash("sha256").update(JSON.stringify(allSeeds)).digest("hex");
  const configHash = createHash("sha256").update(JSON.stringify({ option: artifact.option, config: artifact.baseConfig })).digest("hex");
  if (uniqueSeeds.size !== allSeeds.length || allSeeds.length !== artifact.seedManifest.total || seedHash !== artifact.seedManifest.hash) add({ id: "T-001", severity: "CRITICAL", title: "Seed manifest integrity failed", evidence: `${uniqueSeeds.size} unique IDs across ${allSeeds.length} entries; stored hash match: ${seedHash === artifact.seedManifest.hash}.`, remediation: "Regenerate mutually disjoint splits and their content hash." });
  const countEvidence = artifact.evidenceCounts;
  const policyCountsMatch = Object.values(countEvidence.policySeedCount).every(count => count === artifact.seedManifest.total);
  if (configHash !== artifact.configHash || countEvidence.reconciledRunCount !== countEvidence.expectedRunCount || countEvidence.terminalFlatRunCount !== countEvidence.expectedRunCount || !policyCountsMatch || artifact.final.summaries.some(row => !row.reconciled)) add({ id: "T-002", severity: "CRITICAL", title: "Research evidence count failed", evidence: `Config hash match: ${configHash === artifact.configHash}; reconciled ${countEvidence.reconciledRunCount}/${countEvidence.expectedRunCount}; liquidated ${countEvidence.terminalFlatRunCount}/${countEvidence.expectedRunCount}; policy counts match: ${policyCountsMatch}.`, remediation: "Block publication until counts and content hashes reconcile." });
  const interval = artifact.final.adaptiveVsBaseline.confidenceInterval;
  if (interval[0] <= 0 && interval[1] >= 0) add({ id: "T-003", severity: "HIGH", title: "Final paired interval crosses zero", evidence: `Held-out interval is [${interval[0].toFixed(2)}, ${interval[1].toFixed(2)}].`, remediation: "Treat the policy difference as inconclusive and collect more independent evidence." });
  const adaptiveStress = artifact.stresses.map(stress => ({ name: stress.name, summary: stress.summaries.find(row => row.policy === "INVENTORY_TOXICITY_AWARE")! }));
  const hostile = adaptiveStress.filter(row => row.summary.negativeSeedRate >= 0.25 || row.summary.p05NetPnl < -100);
  if (hostile.length) add({ id: "T-004", severity: "HIGH", title: "Material hostile-regime fragility", evidence: hostile.map(row => `${row.name}: ${(row.summary.negativeSeedRate * 100).toFixed(1)}% negative, p05 ${row.summary.p05NetPnl.toFixed(2)}`).join("; "), remediation: "Add hard risk limits and reject deployment outside calibrated operating conditions." });
  const attribution = artifact.train?.attribution;
  const unattributed = (attribution?.steps ?? []).filter(step => ["INVENTORY_SKEW", "BEYOND_SPREAD_WIDTH"].includes(step.id) && step.confidenceInterval[0] <= 0);
  if (unattributed.length) add({ id: "T-006", severity: "MEDIUM", title: "Improvement is not attributable to the adaptive mechanism", evidence: `Train split (${attribution!.seeds} seeds): ${unattributed.map(step => `${step.id} ${step.observedMeanDifference.toFixed(2)} [${step.confidenceInterval[0].toFixed(2)}, ${step.confidenceInterval[1].toFixed(2)}]`).join("; ")}.`, remediation: "Describe the gain as hedging plus spread width, or preregister a revised adaptive policy and test it on fresh held-out seeds." });
  if (artifact.syntheticOnly) add({ id: "T-005", severity: "INFO", title: "Evidence is simulator-bound", evidence: "All displayed outcomes come from a declared synthetic generator.", remediation: "Add historical event replay and forward paper trading before making any empirical market claim." });
  const score = Math.max(0, 100 - findings.reduce((total, finding) => total + weights[finding.severity], 0));
  const verdict = findings.some(finding => finding.severity === "CRITICAL") ? "BLOCKED" : findings.some(finding => finding.severity === "HIGH") ? "RESEARCH PASS · DEPLOYMENT BLOCKED" : "RESEARCH PASS";
  return { score, verdict, findings };
}
