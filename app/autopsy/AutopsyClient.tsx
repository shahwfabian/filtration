"use client";

import { useMemo, useState } from "react";
import { Metric } from "../../components/LabShell";
import { defaultOptionSpec, defaultResearchConfig } from "../../lib/research/config";
import { auditScenarioDecision } from "../../lib/research/replay";
import { generateScenario } from "../../lib/research/scenario";
import { simulatePolicy } from "../../lib/research/simulate";

const money = (value: number) => `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(2)}`;

export function AutopsyClient() {
  const decisions = useMemo(() => {
    const scenario = generateScenario(847, defaultResearchConfig, defaultOptionSpec);
    const run = simulatePolicy(scenario, "INVENTORY_TOXICITY_AWARE");
    return Array.from({ length: 20 }, (_, index) => {
      const time = index * 5 + 1;
      const previousInventory = time === 0 ? 0 : run.records[time - 1].optionInventory;
      return auditScenarioDecision(scenario, time, previousInventory, run.records[time].posterior);
    });
  }, []);
  const [selected, setSelected] = useState(0);
  const decision = decisions[selected];
  const cumulativeRegret = decisions.reduce((total, row) => total + row.regret, 0);
  return <>
    <div className="autopsy-summary"><Metric label="CUMULATIVE REGRET" value={money(cumulativeRegret)} sub="20 sampled decisions" tone="gold" /><Metric label="SELECTED EXPECTED ACTION" value={decision.selectedAction.name} sub="future state excluded" tone="teal" /><Metric label="EVENT REGRET" value={money(decision.regret)} sub="ex-post diagnostic" /><Metric label="SEED" value="847" sub="reproducible scenario" /></div>
    <div className="autopsy-grid">
      <section className="panel replay-list"><div className="panel-head"><span>EVENT TIMELINE</span><em>CLICK TO INSPECT</em></div>{decisions.map((row, index) => <button className={selected === index ? "replay-row selected" : "replay-row"} key={row.state.time} onClick={() => setSelected(index)}><span>{String(index + 1).padStart(2, "0")}</span><b>t={row.state.time}</b><i>{row.event.side ?? "NONE"}</i><strong>{row.selectedAction.name}</strong><em>{money(row.regret)}</em></button>)}</section>
      <section className="autopsy-detail">
        <section className="panel"><div className="panel-head"><span>DECISION-TIME INFORMATION</span><em>NO NEXT-STATE FIELDS</em></div><div className="state-grid"><div><small>SPOT</small><b>{money(decision.state.spot)}</b></div><div><small>OPTION FAIR</small><b>{money(decision.state.fairValue)}</b></div><div><small>INVENTORY</small><b>{decision.state.optionInventory}</b></div><div><small>P(INFORMED BUY)</small><b>{(decision.state.posterior.informedBuy * 100).toFixed(1)}%</b></div></div></section>
        <section className="panel"><div className="panel-head"><span>SAME-EVENT COUNTERFACTUALS</span><em>EXPECTED CHOICE / REALIZED GRADING</em></div><div className="action-table"><div className="action-head"><span>ACTION</span><span>FILL</span><span>EXPECTED U</span><span>REALIZED U</span></div>{decision.alternatives.map(row => <div className={row.action.name === decision.selectedAction.name ? "action-row chosen" : "action-row"} key={row.action.name}><span>{row.action.name}{row.action.name === decision.selectedAction.name && <i>SELECTED</i>}</span><span>{row.fill || "—"}</span><span>{money(row.expectedUtility)}</span><span>{money(row.realizedUtility)}</span></div>)}</div></section>
        <section className="panel"><div className="panel-head"><span>REVEALED AFTER ACTION</span><em>EX-POST DIAGNOSTIC</em></div><div className="outcome-grid"><div><small>CUSTOMER</small><b>{decision.event.side ?? "NONE"}</b></div><div><small>NEXT SPOT</small><b>{money(decision.nextState.spot)}</b></div><div><small>REALIZED BEST</small><b>{decision.alternatives.find(row => row.realizedUtility === decision.bestUtility)?.action.name}</b></div><div><small>REGRET</small><b>{money(decision.regret)}</b></div></div><div className="luck-callout"><strong>NO FORESIGHT CLAIM</strong><span>Regret grades the chosen action after the event. The policy never receives the event side or next state when computing expected utility.</span></div></section>
      </section>
    </div>
  </>;
}
