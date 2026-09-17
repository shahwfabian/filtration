import artifact from "../../benchmarks/research-v2.json";
import { LabShell, Metric } from "../../components/LabShell";

const labels: Record<string, string> = { BASELINE: "Symmetric unhedged", DELTA_HEDGED: "Symmetric delta-hedged", INVENTORY_TOXICITY_AWARE: "Inventory + toxicity aware" };
const money = (value: number) => `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(2)}`;
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function StrategyPage() {
  const comparison = artifact.final.adaptiveVsBaseline;
  const counts = artifact.evidenceCounts;
  const finalReconciled = artifact.final.summaries.every(summary => summary.reconciled);
  return <LabShell activePath="/strategy" eyebrow="POLICY COMPARISON / COMMON RANDOM NUMBERS" title="Policy Comparison" status="ARTIFACT-BACKED">
    <section className="tribunal-hero panel"><div><p className="eyebrow">HELD-OUT RESULT</p><h2>{money(comparison.observedMeanDifference)} paired mean improvement</h2><p>Every policy faces the same 200 final scenarios. The comparison is paired by seed and includes fees, spread, impact, latency, and mandatory terminal liquidation.</p></div><div className="verdict-score"><strong>{pct(comparison.probabilityOfImprovement)}</strong><span>seed-level win frequency</span></div></section>
    <section className="panel strategy-table">
      <div className="panel-head"><span>FINAL POLICY PANEL</span><em>{artifact.seedManifest.final.length} UNTOUCHED SEEDS</em></div>
      <div className="strategy-head"><span>POLICY</span><span>MEAN NET P&amp;L</span><span>P05 / WORST</span><span>NEGATIVE</span><span>MAX |Δ|</span></div>
      {artifact.final.summaries.map(summary => <div className={summary.policy === "INVENTORY_TOXICITY_AWARE" ? "strategy-row selected" : "strategy-row"} key={summary.policy}>
        <span><b>{labels[summary.policy]}</b><small>{summary.policy}</small></span><strong>{money(summary.meanNetPnl)}</strong><strong className="negative">{money(summary.p05NetPnl)}<small>{money(summary.worstNetPnl)} worst</small></strong><span>{pct(summary.negativeSeedRate)}</span><span>{summary.meanMaxAbsDelta.toFixed(1)}</span>
      </div>)}
    </section>
    <div className="metrics">
      <Metric label="PAIRED 95% CI" value={money(comparison.confidenceInterval[0])} sub={`to ${money(comparison.confidenceInterval[1])}`} tone="teal" />
      <Metric label="RESAMPLES" value={comparison.resamples.toLocaleString()} sub="paired bootstrap indices" />
      <Metric label="DECLARED BENCHMARK" value="BASELINE" sub="fixed before inference" tone="gold" />
      <Metric label="RECONCILIATION" value={finalReconciled ? "PASSED" : "FAILED"} sub={`${counts.reconciledRunCount.toLocaleString()} / ${counts.expectedRunCount.toLocaleString()} ledger-checked runs`} tone={finalReconciled ? "teal" : "gold"} />
    </div>
    <p className="footnote"><span>SOURCE · benchmarks/research-v2.json</span><span>CONFIG · {artifact.configHash.slice(0, 12)}</span><span>SYNTHETIC MECHANISM TEST</span></p>
  </LabShell>;
}
