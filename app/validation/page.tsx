import artifact from "../../benchmarks/research-v2.json";
import { LabShell, Metric } from "../../components/LabShell";

const money = (value: number) => `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(2)}`;
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function ValidationPage() {
  const train = artifact.train.summaries.find(row => row.policy === "INVENTORY_TOXICITY_AWARE")!;
  const validation = artifact.validation.summaries.find(row => row.policy === "INVENTORY_TOXICITY_AWARE")!;
  const final = artifact.final.summaries.find(row => row.policy === "INVENTORY_TOXICITY_AWARE")!;
  const rows = [["TRAIN", train, artifact.seedManifest.train.length], ["VALIDATION", validation, artifact.seedManifest.validation.length], ["FINAL", final, artifact.seedManifest.final.length]] as const;
  return <LabShell activePath="/validation" eyebrow="FROZEN MANIFEST / DISJOINT SEED SPLITS" title="Untouched Validation" status="NO SEED LEAKAGE">
    <section className="tribunal-hero panel"><div><p className="eyebrow">PREDECLARED SPLIT</p><h2>{artifact.seedManifest.train.length} / {artifact.seedManifest.validation.length} / {artifact.seedManifest.final.length}</h2><p>Training supports model development. Validation supports iteration checks. The final split is reserved for the displayed held-out comparison and remains disjoint by construction.</p></div><div className="verdict-score"><strong>{artifact.seedManifest.total}</strong><span>manifested scenarios</span></div></section>
    <section className="panel strategy-table"><div className="panel-head"><span>ADAPTIVE POLICY BY SPLIT</span><em>NO CROSS-SPLIT RESAMPLING</em></div><div className="strategy-head"><span>SPLIT</span><span>MEAN P&amp;L</span><span>P05 / WORST</span><span>NEGATIVE</span><span>SEEDS</span></div>{rows.map(([name, row, count]) => <div className={name === "FINAL" ? "strategy-row selected" : "strategy-row"} key={name}><span><b>{name}</b><small>{name === "FINAL" ? "held out for delivery" : "development evidence"}</small></span><strong>{money(row.meanNetPnl)}</strong><strong className="negative">{money(row.p05NetPnl)}<small>{money(row.worstNetPnl)} worst</small></strong><span>{pct(row.negativeSeedRate)}</span><span>{count}</span></div>)}</section>
    <div className="metrics"><Metric label="SEED MANIFEST" value={artifact.seedManifest.hash.slice(0, 12)} sub="SHA-256 prefix" tone="gold" /><Metric label="FINAL PAIRED EFFECT" value={money(artifact.final.adaptiveVsBaseline.observedMeanDifference)} sub="adaptive minus baseline" tone="teal" /><Metric label="FINAL CI LOW" value={money(artifact.final.adaptiveVsBaseline.confidenceInterval[0])} sub="paired 95% interval" /><Metric label="DISJOINT" value={artifact.invariants.finalSeedsDisjoint ? "VERIFIED" : "FAILED"} sub="train / validation / final" tone="teal" /></div>
    <p className="footnote"><span>MANIFEST · IMMUTABLE IN ARTIFACT</span><span>FINAL SEEDS · {artifact.seedManifest.final[0]}–{artifact.seedManifest.final.at(-1)}</span><span>NO HISTORICAL CLAIM</span></p>
  </LabShell>;
}
