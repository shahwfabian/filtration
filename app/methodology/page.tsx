import Link from "next/link";
import artifact from "../../benchmarks/research-v2.json";
import { LabShell } from "../../components/LabShell";

const sections = [
  ["Two probability measures", "Black–Scholes values the European call under Q. A separate physical process under P generates the tradable scenario and informed-flow signal."],
  ["Coherent execution", "Customers trade the option. Delta hedges trade the underlying through a venue with spread, market impact, fees, and latency."],
  ["Risk-aware quotation", "Reservation price responds to inventory. Bid and ask widths respond directionally to the filtered informed-buy and informed-sell posterior."],
  ["Paired research design", "All policies share scenario seeds. Bootstrap comparisons retain those pairs and the family-wide check uses one shared resampling vector."],
  ["Terminal accounting", "Open option and underlying inventories are forcibly liquidated. Every displayed run is reconciled by rebuilding its positions and cash from its own execution ledger."],
  ["Honest boundary", "The generator is synthetic, and the held-out gain is mostly hedging plus spread width rather than the adaptive mechanism. This project demonstrates quantitative reasoning and experimental controls, not historical or live profitability."],
];

export default function MethodologyPage() {
  return <LabShell activePath="/methodology" eyebrow="MODEL CARD / REPRODUCIBILITY / LIMITATIONS" title="Methodology" status="PROTOCOL FROZEN">
    <section className="tribunal-hero panel"><div><p className="eyebrow">BINDING RESEARCH CONSTITUTION</p><h2>One state system from quote to liquidation.</h2><p>The implementation is governed by explicit instrument, timing, inference, replay, and evidence rules. A result that violates an invariant is blocked rather than displayed as a pass.</p></div><div className="verdict-score"><strong>V2</strong><span>{artifact.configHash.slice(0, 12)}</span></div></section>
    <section className="panel methodology-grid">{sections.map(([title, body], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{body}</p></article>)}</section>
    <section className="panel caveat"><strong>Reproduce it</strong><p>Run <code>corepack pnpm@9 run research:v2</code> to regenerate the benchmark, then <code>corepack pnpm@9 test</code> to exercise pricing, scenario coupling, quotation, hedging, liquidation, ledger reconciliation, inference, and replay invariants. The repository pins pnpm; <code>npm install</code> ignores the lockfile.</p><Link href="https://github.com/shahwfabian/filtration/blob/agent/options-market-making-lab/docs/RESEARCH_CONSTITUTION.md" className="secondary">Read the research constitution</Link></section>
    <p className="footnote"><span>SEED MANIFEST · {artifact.seedManifest.hash.slice(0, 12)}</span><span>SCHEMA · V{artifact.schemaVersion}</span><span>SYNTHETIC ONLY</span></p>
  </LabShell>;
}
