import Link from "next/link";

import artifact from "../benchmarks/research-v2.json";
import { LabShell, Metric } from "../components/LabShell";

const money = (value: number) => `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(2)}`;
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function OverviewPage() {
  const adaptive = artifact.final.summaries.find(summary => summary.policy === "INVENTORY_TOXICITY_AWARE")!;
  const baseline = artifact.final.summaries.find(summary => summary.policy === "BASELINE")!;
  const comparison = artifact.final.adaptiveVsBaseline;
  const counts = artifact.evidenceCounts;
  const allReconciled = counts.reconciledRunCount === counts.expectedRunCount;
  return <LabShell activePath="/" eyebrow="SYNTHETIC OPTIONS MARKET MAKING / RESEARCH PROTOCOL V2" title="Research Overview" status="EVIDENCE GENERATED">
    <section className="research-hero panel">
      <div>
        <p className="eyebrow">RESEARCH QUESTION</p>
        <h2>How should an option market maker quote when inventory risk and informed flow arrive together?</h2>
        <p>The engine prices a European call under Q, evolves the trading environment under P, executes option flow against delayed quotes, and routes delta hedges through a frictional underlying venue.</p>
        <p><strong>Filtration is the governing constraint:</strong> every action is measurable with respect to 𝓕ₜ, the information available before the next state is revealed.</p>
        <div className="hero-actions">
          <Link href="/arena" className="primary">Enter the Trading Arena</Link>
          <Link href="/methodology" className="secondary">Inspect the protocol</Link>
        </div>
      </div>
      <div className="protocol-stamp">
        <span>FINAL MANIFEST</span>
        <strong>{artifact.seedManifest.final.length}</strong>
        <small>untouched seeds</small>
        <code>{artifact.seedManifest.hash.slice(0, 12)}</code>
      </div>
    </section>
    <div className="metrics">
      <Metric label="PAIRED P&L DIFFERENCE" value={money(comparison.observedMeanDifference)} sub={`95% CI ${money(comparison.confidenceInterval[0])} to ${money(comparison.confidenceInterval[1])}`} tone="teal" />
      <Metric label="IMPROVEMENT FREQUENCY" value={percent(comparison.probabilityOfImprovement)} sub="adaptive beat baseline per seed" />
      <Metric label="BASELINE NEGATIVE SEEDS" value={percent(baseline.negativeSeedRate)} sub={`${baseline.seeds} untouched scenarios`} tone="gold" />
      <Metric label="ADAPTIVE MAX DELTA" value={adaptive.meanMaxAbsDelta.toFixed(1)} sub="shares, with hedge friction" />
    </div>
    <section className="panel architecture-panel">
      <div className="panel-head"><span>EXPERIMENT ARCHITECTURE</span><em>ONE COHERENT STATE SYSTEM</em></div>
      <div className="architecture-flow">
        {["Underlying S(t)", "Option value + Greeks", "Reservation price", "Delayed option fill", "Frictional hedge", "Terminal liquidation"].map((label, index) => <div key={label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong></div>)}
      </div>
    </section>
    <section className="research-grid">
      <article className="panel research-card"><span>MODEL</span><h3>Separate instruments</h3><p>The option is quoted around its theoretical value. The underlying exists only as the state driver and hedge instrument.</p></article>
      <article className="panel research-card"><span>FLOW</span><h3>Measurable adverse selection</h3><p>Latent informed direction predicts the subsequent spot move. Every policy receives the same scenario.</p></article>
      <article className="panel research-card"><span>INFERENCE</span><h3>Paired evidence</h3><p>Policy differences retain common seed indices during resampling. The declared benchmark remains visible.</p></article>
      <article className="panel research-card"><span>SCOPE</span><h3>Synthetic by construction</h3><p>The results evaluate mechanisms inside the declared simulator. They do not establish market profitability.</p></article>
    </section>
    <p className="footnote"><span>AUTHOR · SHAH WASIF FABIAN</span><span>CONFIG · {artifact.configHash.slice(0, 12)}</span><span>RECONCILED RUNS · <b className={allReconciled ? "ok" : "negative"}>{counts.reconciledRunCount.toLocaleString()} / {counts.expectedRunCount.toLocaleString()}</b></span></p>
  </LabShell>;
}
