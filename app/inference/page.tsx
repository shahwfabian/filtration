import artifact from "../../benchmarks/research-v2.json";
import { LabShell, Metric } from "../../components/LabShell";

const money = (value: number) => `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(2)}`;

export default function InferencePage() {
  const check = artifact.train.pairedRealityCheck;
  return <LabShell activePath="/inference" eyebrow="BENCHMARK-RELATIVE REALITY CHECK / PAIRED RESAMPLING" title="Paired Inference" status="TRAINING SPLIT">
    <section className="tribunal-hero panel"><div><p className="eyebrow">NULL HYPOTHESIS</p><h2>No candidate improves expected net P&amp;L over baseline.</h2><p>{check.nullHypothesis}. One shared resampling index vector is applied across all policy candidates so scenario pairing and cross-policy dependence survive the bootstrap.</p></div><div className="verdict-score"><strong>{check.bootstrapPValue.toFixed(4)}</strong><span>family-wide p-value · {artifact.seedManifest.train.length} training seeds</span></div></section>
    <section className="panel inference-grid">
      {check.candidates.map(candidate => <article key={candidate}><span>CANDIDATE</span><h3>{candidate.replaceAll("_", " ")}</h3><strong>{money(check.observedMeanDifferences[candidate as keyof typeof check.observedMeanDifferences])}</strong><p>Observed paired mean difference versus {check.benchmark}.</p></article>)}
      <article><span>MAX STATISTIC</span><h3>FAMILY-WIDE</h3><strong>{money(check.observedMaxMeanDifference)}</strong><p>Maximum centered candidate statistic over the declared family.</p></article>
    </section>
    <div className="metrics"><Metric label="RESAMPLES" value={check.resamples.toLocaleString()} sub="common index vectors" /><Metric label="PAIRING" value={check.pairingPreserved ? "PRESERVED" : "BROKEN"} sub="same scenario per policy" tone="teal" /><Metric label="BENCHMARK" value={check.benchmark} sub="declared reference" tone="gold" /><Metric label="EVIDENCE DOMAIN" value="SYNTHETIC" sub="not a live alpha claim" /></div>
    <section className="panel caveat"><strong>Interpretation boundary</strong><p>A low simulated p-value rejects the null inside this specified generator. It does not validate the generator against an exchange, prove independent observations, or estimate deployable profitability.</p></section>
  </LabShell>;
}
