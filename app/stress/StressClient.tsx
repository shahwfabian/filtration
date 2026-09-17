"use client";

import { useState } from "react";
import { Metric } from "../../components/LabShell";

type Summary = { policy: string; seeds: number; meanNetPnl: number; p05NetPnl: number; worstNetPnl: number; negativeSeedRate: number; meanMaxAbsDelta: number };
type StressCase = { name: string; summaries: Summary[]; changes: string[] };
const money = (value: number) => `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(2)}`;
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export function StressClient({ cases }: { cases: StressCase[] }) {
  const [selected, setSelected] = useState(0);
  const stress = cases[selected];
  const adaptive = stress.summaries.find(row => row.policy === "INVENTORY_TOXICITY_AWARE")!;
  return <>
    <section className="panel stress-picker" aria-label="Stress scenario selection">{cases.map((item, index) => <button className={selected === index ? "selected" : ""} key={item.name} onClick={() => setSelected(index)}>{item.name.replaceAll("_", " ")}</button>)}</section>
    <section className="tribunal-hero panel"><div><p className="eyebrow">SELECTED REGIME</p><h2>{stress.name.replaceAll("_", " ")}</h2><p>{stress.changes.length ? stress.changes.join(" · ") : "Reference configuration. No parameter changes."}</p></div><div className="verdict-score"><strong>{pct(adaptive.negativeSeedRate)}</strong><span>adaptive negative seeds</span></div></section>
    <div className="metrics"><Metric label="ADAPTIVE MEAN" value={money(adaptive.meanNetPnl)} sub={`${adaptive.seeds} common seeds`} tone="teal" /><Metric label="ADAPTIVE P05" value={money(adaptive.p05NetPnl)} sub="left-tail diagnostic" tone="gold" /><Metric label="WORST SEED" value={money(adaptive.worstNetPnl)} sub="not hidden or winsorized" /><Metric label="MEAN MAX |Δ|" value={adaptive.meanMaxAbsDelta.toFixed(1)} sub="shares through path" /></div>
    <section className="panel strategy-table"><div className="panel-head"><span>POLICY RESPONSE</span><em>SAME SEEDS · CHANGED ENVIRONMENT</em></div><div className="strategy-head"><span>POLICY</span><span>MEAN</span><span>P05</span><span>NEGATIVE</span><span>WORST</span></div>{stress.summaries.map(row => <div className={row.policy === "INVENTORY_TOXICITY_AWARE" ? "strategy-row selected" : "strategy-row"} key={row.policy}><span><b>{row.policy.replaceAll("_", " ")}</b><small>{row.seeds} scenarios</small></span><strong>{money(row.meanNetPnl)}</strong><strong className="negative">{money(row.p05NetPnl)}</strong><span>{pct(row.negativeSeedRate)}</span><strong className="negative">{money(row.worstNetPnl)}</strong></div>)}</section>
    <p className="footnote"><span>STRESS RESULTS ARE NOT OPTIMIZATION TARGETS</span><span>NEGATIVE REGIMES ARE DELIVERY EVIDENCE</span><span>SYNTHETIC ONLY</span></p>
  </>;
}
