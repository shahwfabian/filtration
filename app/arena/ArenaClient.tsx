"use client";

import { useMemo, useState } from "react";

import { defaultOptionSpec, defaultResearchConfig } from "../../lib/research/config";
import { evaluateCounterfactual, replayActions, type CounterfactualResult } from "../../lib/research/replay";
import { generateScenario } from "../../lib/research/scenario";
import { DirectionalToxicityFilter } from "../../lib/research/toxicity";
import type { ToxicityPosterior } from "../../lib/research/types";
import { optionAnalytics } from "../../lib/research/policy";

const money = (value: number) => `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(2)}`;

function posteriorPath(seed: number) {
  const scenario = generateScenario(seed, defaultResearchConfig, defaultOptionSpec);
  const filter = new DirectionalToxicityFilter();
  const path: ToxicityPosterior[] = [];
  for (let time = 0; time < scenario.events.length; time += 1) {
    path.push(filter.posterior());
    filter.update({
      side: scenario.events[time].side,
      imbalance: scenario.events[time].imbalance,
      observedReturn: scenario.states[time + 1].spot / scenario.states[time].spot - 1,
    });
  }
  return { scenario, path };
}

export function ArenaClient() {
  const [seed, setSeed] = useState(73);
  const [time, setTime] = useState(0);
  const [inventory, setInventory] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<{ selected: CounterfactualResult; alternatives: CounterfactualResult[] } | null>(null);
  const { scenario, path } = useMemo(() => posteriorPath(seed), [seed]);
  const state = scenario.states[time];
  const fair = optionAnalytics({ time, spot: state.spot, volatility: state.volatility, config: scenario.config, option: scenario.option }).call;
  const actions = replayActions(scenario.config.baseOptionHalfSpread);

  const choose = (name: string) => {
    if (result) return;
    const decision = { time, spot: state.spot, volatility: state.volatility, fairValue: fair, optionInventory: inventory, posterior: path[time] };
    const alternatives = actions.map(action => evaluateCounterfactual(action, decision, scenario.events[time], scenario.states[time + 1], scenario));
    const selected = alternatives.find(item => item.action.name === name)!;
    setResult({ selected, alternatives });
    setInventory(current => current + selected.fill);
    setScore(current => current + selected.realizedUtility);
  };

  const next = () => {
    setResult(null);
    setTime(current => current === 11 ? 0 : current + 1);
    if (time === 11) { setInventory(0); setScore(0); setSeed(current => current + 1); }
  };

  const best = result?.alternatives.filter(item => item.feasible).reduce((winner, item) => item.realizedUtility > winner.realizedUtility ? item : winner);
  const regret = result && best ? Math.max(0, best.realizedUtility - result.selected.realizedUtility) : 0;

  return <>
    <section className="panel arena-hero">
      <div><p className="eyebrow">ROUND {String(time + 1).padStart(2, "0")} / 12 · SEED {seed}</p><h2>Quote before the next state is revealed.</h2><p>You see only information available at decision time. Every action is graded against the same latent customer event and subsequent option mark.</p></div>
      <div className="arena-score"><strong>{money(score)}</strong><span>cumulative realized utility</span></div>
    </section>
    <div className="metrics">
      <Mini label="SPOT" value={money(state.spot)} />
      <Mini label="OPTION FAIR" value={money(fair)} />
      <Mini label="INVENTORY" value={`${inventory} contracts`} />
      <Mini label="P(INFORMED BUY)" value={`${(path[time].informedBuy * 100).toFixed(1)}%`} />
    </div>
    <section className="panel decision-panel">
      <div className="panel-head"><span>YOUR ACTION</span><em>{result ? "EVENT REVEALED" : "FUTURE STATE LOCKED"}</em></div>
      <div className="action-buttons">{actions.map(action => <button key={action.name} disabled={Boolean(result)} onClick={() => choose(action.name)}><strong>{action.name}</strong><small>{action.name === "PASS" ? "do not quote" : `±${money(action.askDistance)}`}</small></button>)}</div>
      {result && <div className="reveal" aria-live="polite">
        <div><span>CUSTOMER</span><strong>{scenario.events[time].side ?? "NO ARRIVAL"}</strong></div>
        <div><span>NEXT SPOT</span><strong>{money(scenario.states[time + 1].spot)}</strong></div>
        <div><span>YOUR FILL</span><strong>{result.selected.fill || "NONE"}</strong></div>
        <div><span>UTILITY</span><strong>{money(result.selected.realizedUtility)}</strong></div>
        <div><span>EX-POST BEST</span><strong>{best?.action.name}</strong></div>
        <div><span>REGRET</span><strong>{money(regret)}</strong></div>
      </div>}
      {result && <button className="primary arena-next" onClick={next}>{time === 11 ? "Start next seeded game" : "Next round"}</button>}
    </section>
    <p className="footnote"><span>EXPECTED UTILITY USES CURRENT POSTERIOR ONLY</span><span>OUTCOME USED ONLY AFTER ACTION</span><span>NO LIVE ORDERS</span></p>
  </>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small>decision-time state</small></div>;
}
