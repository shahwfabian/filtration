import Link from "next/link";

import artifact from "../benchmarks/research-v2.json";
import { LabShell, Metric } from "../components/LabShell";

const money = (value: number) => `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(2)}`;
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const interval = ([low, high]: number[]) => `[${money(low)}, ${money(high)}]`;

export default function OverviewPage() {
  const summary = (policy: string) => artifact.final.summaries.find(row => row.policy === policy)!;
  const adaptive = summary("INVENTORY_TOXICITY_AWARE");
  const baseline = summary("BASELINE");
  const hedged = summary("DELTA_HEDGED");
  const comparison = artifact.final.adaptiveVsBaseline;
  const attribution = artifact.train.attribution;
  const step = (id: string) => attribution.steps.find(row => row.id === id)!;
  const widthMatched = step("BEYOND_SPREAD_WIDTH");
  const skew = step("INVENTORY_SKEW");
  const extreme = artifact.stresses.find(stress => stress.name === "EXTREME_TOXICITY")!.summaries.find(row => row.policy === "INVENTORY_TOXICITY_AWARE")!;
  const counts = artifact.evidenceCounts;
  const allReconciled = counts.reconciledRunCount === counts.expectedRunCount;
  const sessionMinutes = artifact.baseConfig.steps;

  const findings = [
    {
      tag: "HEDGING",
      title: "Delta hedging removes most of the left tail.",
      body: `Unhedged quoting lost money in ${percent(baseline.negativeSeedRate)} of held-out sessions (worst ${money(baseline.worstNetPnl)}). Hedging through a costly underlying market cut that to ${percent(hedged.negativeSeedRate)} (worst ${money(hedged.worstNetPnl)}).`,
    },
    {
      tag: "HEADLINE",
      title: `The adaptive quoter earns ${money(comparison.observedMeanDifference)} more per session than unhedged quoting.`,
      body: `Paired over ${artifact.seedManifest.final.length} held-out sessions: 95% bootstrap interval ${interval(comparison.confidenceInterval)}, better in ${percent(comparison.probabilityOfImprovement)} of sessions.`,
    },
    {
      tag: "ATTRIBUTION",
      title: "But the extra edge comes from quoting wider, not from being smarter.",
      body: `On the ${attribution.seeds} training sessions, a plain hedged quote at ±${money(attribution.matchedHalfSpread)} does as well (difference ${money(widthMatched.observedMeanDifference)}, interval ${interval(widthMatched.confidenceInterval)}). The inventory skew moves quotes by less than one tick (${money(skew.observedMeanDifference)}).`,
    },
    {
      tag: "LIMITS",
      title: "Hostile flow still breaks it, so deployment stays blocked.",
      body: `With persistent, highly informed flow the adaptive quoter loses money in ${percent(extreme.negativeSeedRate)} of sessions (5th percentile ${money(extreme.p05NetPnl)}). Everything here is synthetic and says nothing about live profitability.`,
    },
  ];

  return <LabShell activePath="/" eyebrow="SYNTHETIC OPTIONS MARKET MAKING / RESEARCH PROTOCOL V2" title="Research Overview" status="EVIDENCE GENERATED">
    <section className="research-hero panel">
      <div>
        <p className="eyebrow">RESEARCH QUESTION</p>
        <h2>How should an option market maker quote when inventory risk and informed flow arrive together?</h2>
        <p>A simulated market maker quotes a 30-day at-the-money call for {sessionMinutes}-minute sessions. Some customers are noise traders; others know which way the stock is about to move. Three quoting policies trade the exact same {artifact.seedManifest.total.toLocaleString()} sessions, so any difference comes from the policy rather than from luck.</p>
        <p>The option is priced with Black–Scholes under the risk-neutral measure, while the stock moves under a separate real-world model. Quotes fill after a delay, hedges pay spread, impact, and fees, and every position is closed at the end. The name <strong>Filtration</strong> refers to the rule every policy obeys: it may only use information available at the moment it quotes.</p>
        <div className="hero-actions">
          <Link href="/strategy" className="primary">See the policy comparison</Link>
          <Link href="/arena" className="secondary">Try quoting yourself</Link>
        </div>
      </div>
      <div className="protocol-stamp">
        <span>HELD-OUT SESSIONS</span>
        <strong>{artifact.seedManifest.final.length}</strong>
        <small>evaluated once, never tuned on</small>
        <code>{artifact.seedManifest.hash.slice(0, 12)}</code>
      </div>
    </section>
    <section className="panel findings-panel">
      <div className="panel-head"><span>WHAT THE EVIDENCE SAYS</span><em>EVERY NUMBER IS READ FROM THE GENERATED ARTIFACT</em></div>
      <div className="findings-grid">
        {findings.map(finding => <article key={finding.tag}><span>{finding.tag}</span><h3>{finding.title}</h3><p>{finding.body}</p></article>)}
      </div>
    </section>
    <div className="metrics">
      <Metric label="PAIRED P&L DIFFERENCE" value={money(comparison.observedMeanDifference)} sub={`adaptive minus unhedged, 95% CI ${money(comparison.confidenceInterval[0])} to ${money(comparison.confidenceInterval[1])}`} tone="teal" />
      <Metric label="WIDTH-MATCHED DIFFERENCE" value={money(widthMatched.observedMeanDifference)} sub={`adaptive minus hedged ±${money(attribution.matchedHalfSpread)}, training sessions`} tone="gold" />
      <Metric label="UNHEDGED LOSING SESSIONS" value={percent(baseline.negativeSeedRate)} sub={`hedged: ${percent(hedged.negativeSeedRate)} · adaptive: ${percent(adaptive.negativeSeedRate)}`} />
      <Metric label="ADAPTIVE MAX DELTA" value={adaptive.meanMaxAbsDelta.toFixed(1)} sub={`shares on average, vs ${baseline.meanMaxAbsDelta.toFixed(1)} unhedged`} />
    </div>
    <section className="panel architecture-panel">
      <div className="panel-head"><span>ONE SIMULATED STEP</span><em>REPEATED EVERY MINUTE OF THE SESSION</em></div>
      <div className="architecture-flow">
        {["Stock price S(t) moves", "Option value + Greeks", "Quote around a reservation price", "Customer fills the delayed quote", "Hedge the delta at a cost", "Close everything at the end"].map((label, index) => <div key={label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong></div>)}
      </div>
    </section>
    <section className="research-grid">
      <article className="panel research-card"><span>POLICY COMPARISON</span><h3>Three policies, same sessions</h3><p>Held-out results, and a step-by-step breakdown of where the improvement comes from.</p><Link href="/strategy" className="card-link">Open →</Link></article>
      <article className="panel research-card"><span>STRESS LABORATORY</span><h3>Where it fails</h3><p>Nine environments, including the hostile ones that block deployment.</p><Link href="/stress" className="card-link">Open →</Link></article>
      <article className="panel research-card"><span>EVIDENCE TRIBUNAL</span><h3>Automated audit</h3><p>Findings recomputed from the artifact: hashes, reconciliation counts, tail risk, attribution.</p><Link href="/tribunal" className="card-link">Open →</Link></article>
      <article className="panel research-card"><span>TRADING ARENA</span><h3>Quote a round yourself</h3><p>Choose a quote before the next customer arrives, then see what you would have regretted.</p><Link href="/arena" className="card-link">Open →</Link></article>
    </section>
    <p className="footnote"><span>AUTHOR · SHAH WASIF FABIAN</span><span>CONFIG · {artifact.configHash.slice(0, 12)}</span><span>RECONCILED RUNS · <b className={allReconciled ? "ok" : "negative"}>{counts.reconciledRunCount.toLocaleString()} / {counts.expectedRunCount.toLocaleString()}</b></span></p>
  </LabShell>;
}
