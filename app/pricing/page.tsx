"use client";

import { useMemo, useState } from "react";

import { LabShell, Metric } from "../../components/LabShell";
import { bs, gbmPath, martingaleDiagnostic, monteCarlo, type Inputs } from "../../lib/quant";

const initial: Inputs = { spot: 100, strike: 100, maturity: 30 / 365, vol: 0.22, rate: 0.05, dividend: 0, paths: 10_000, seed: 42 };
const money = (value: number) => `$${value.toFixed(2)}`;

type Draft = { spot: string; strike: string; days: string; volatility: string; rate: string; paths: string; seed: string };
const toDraft = (inputs: Inputs): Draft => ({
  spot: String(inputs.spot), strike: String(inputs.strike), days: String(inputs.maturity * 365),
  volatility: String(inputs.vol * 100), rate: String(inputs.rate * 100), paths: String(inputs.paths), seed: String(inputs.seed),
});

function parseDraft(draft: Draft): { inputs?: Inputs; error?: string } {
  const values = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, Number(value)])) as Record<keyof Draft, number>;
  if (Object.values(values).some(value => !Number.isFinite(value))) return { error: "Every parameter must contain a finite number." };
  if (!(values.spot > 0)) return { error: "Spot must be greater than zero." };
  if (!(values.strike > 0)) return { error: "Strike must be greater than zero." };
  if (!(values.days > 0 && values.days <= 3650)) return { error: "Maturity must be between 1 and 3,650 days." };
  if (!(values.volatility > 0 && values.volatility <= 300)) return { error: "Volatility must be between 0% and 300%." };
  if (!(values.rate >= -20 && values.rate <= 100)) return { error: "Rate must be between −20% and 100%." };
  if (!Number.isInteger(values.paths) || values.paths < 100 || values.paths > 100_000) return { error: "Paths must be an integer from 100 to 100,000." };
  if (!Number.isInteger(values.seed)) return { error: "Seed must be an integer." };
  return { inputs: { spot: values.spot, strike: values.strike, maturity: values.days / 365, vol: values.volatility / 100, rate: values.rate / 100, dividend: 0, paths: values.paths, seed: values.seed } };
}

export default function PricingPage() {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [inputs, setInputs] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [measure, setMeasure] = useState<"P" | "Q">("Q");
  const analytics = useMemo(() => {
    const price = bs(inputs);
    const mc = monteCarlo(inputs);
    const path = gbmPath(inputs, measure, 30);
    const martingale = martingaleDiagnostic(inputs);
    return { price, mc, path, martingale };
  }, [inputs, measure]);
  const apply = () => {
    const parsed = parseDraft(draft);
    if (!parsed.inputs) return setError(parsed.error ?? "Invalid configuration.");
    setInputs(parsed.inputs);
    setError(null);
  };
  return <LabShell activePath="/pricing" eyebrow="RISK-NEUTRAL VALUATION / PHYSICAL SCENARIO PATH" title="Pricing Laboratory" status="BOUNDED INPUTS">
    <div className="toolbar"><div className="toolbar-title"><span className="signal" />EUROPEAN CALL CONFIGURATION</div><button className="run" onClick={() => { const next = String(Number(draft.seed || inputs.seed) + 1); setDraft(current => ({ ...current, seed: next })); setInputs(current => ({ ...current, seed: Number(next) })); }}>Re-run with next seed</button></div>
    <div className="lab-grid">
      <section className="panel config"><div className="panel-head"><span>01 / PARAMETERS</span><em>APPLY TO RECOMPUTE</em></div>
        <div className="fields">
          <Field id="spot" label="Spot S₀" value={draft.spot} min="0.01" onChange={value => setDraft(current => ({ ...current, spot: value }))} suffix="$" />
          <Field id="strike" label="Strike K" value={draft.strike} min="0.01" onChange={value => setDraft(current => ({ ...current, strike: value }))} suffix="$" />
          <Field id="days" label="Maturity T" value={draft.days} min="1" max="3650" onChange={value => setDraft(current => ({ ...current, days: value }))} suffix="DAYS" />
          <Field id="volatility" label="Volatility σ" value={draft.volatility} min="0.01" max="300" step="0.01" onChange={value => setDraft(current => ({ ...current, volatility: value }))} suffix="%" />
          <Field id="rate" label="Rate r" value={draft.rate} min="-20" max="100" step="0.01" onChange={value => setDraft(current => ({ ...current, rate: value }))} suffix="%" />
          <Field id="paths" label="Antithetic paths M" value={draft.paths} min="100" max="100000" step="100" onChange={value => setDraft(current => ({ ...current, paths: value }))} />
          <Field id="seed" label="Integer seed" value={draft.seed} step="1" onChange={value => setDraft(current => ({ ...current, seed: value }))} />
        </div>
        <div className="measure"><span>Displayed path measure</span><button className={measure === "P" ? "selected" : ""} onClick={() => setMeasure("P")}>P · physical</button><button className={measure === "Q" ? "selected" : ""} onClick={() => setMeasure("Q")}>Q · pricing</button></div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="primary apply-config" onClick={apply}>Apply configuration</button>
      </section>
      <section className="panel chart-panel"><div className="panel-head"><span>02 / UNDERLYING PATH</span><em>{measure} MEASURE · 30 STEPS</em></div><div className="chart-title"><div><strong>Simulated underlying S(t)</strong><small>The option value is computed separately from this path.</small></div></div><Spark data={analytics.path} label={`${measure} measure underlying path`} /><div className="chart-foot"><span>S₀ {money(inputs.spot)}</span><span>T {inputs.maturity.toFixed(3)} yr</span><span>terminal {money(analytics.path.at(-1) ?? 0)}</span></div></section>
    </div>
    <div className="metrics">
      <Metric label="BLACK–SCHOLES CALL" value={money(analytics.price.call)} sub="risk-neutral analytic value" />
      <Metric label="ANTITHETIC MONTE CARLO" value={money(analytics.mc.price)} sub={`95% CI ${money(analytics.mc.low)} to ${money(analytics.mc.high)}`} tone="teal" />
      <Metric label="STANDARD ERROR" value={money(analytics.mc.se)} sub={`${analytics.mc.paths.toLocaleString()} total paths`} tone="gold" />
      <Metric label="PARITY RESIDUAL" value={money(analytics.price.call - analytics.price.put - inputs.spot * Math.exp(-inputs.dividend * inputs.maturity) + inputs.strike * Math.exp(-inputs.rate * inputs.maturity))} sub="C − P − S e⁻qT + K e⁻rT" tone="teal" />
    </div>
    <div className="lower-grid">
      <section className="panel"><div className="panel-head"><span>03 / GREEKS</span><em>UNITS DISCLOSED</em></div><div className="greeks">{[["DELTA", analytics.price.delta, "per $1 spot"], ["GAMMA", analytics.price.gamma, "per $1²"], ["VEGA", analytics.price.vega / 100, "per vol point"], ["THETA", analytics.price.theta / 365, "per day"], ["RHO", analytics.price.rho / 100, "per rate point"]].map(([label, value, unit]) => <div key={String(label)}><span>{label}</span><b>{Number(value).toFixed(4)}</b><small>{unit}</small></div>)}</div><div className="equation">C = S e<sup>−qT</sup>N(d₁) − K e<sup>−rT</sup>N(d₂)</div></section>
      <section className="panel"><div className="panel-head"><span>04 / MARTINGALE DIAGNOSTIC</span><em>DISCOUNTED UNDERLYING</em></div><div className="diagnostic"><div className="diag-ring"><span>{Math.abs(analytics.martingale.error / analytics.martingale.expected * 100).toFixed(2)}%</span><small>error</small></div><div><strong>Q-measure check</strong><p>E<sup>Q</sup>[e<sup>−rT</sup>S<sub>T</sub>] = {money(analytics.martingale.expected)}</p><p>Observed estimate {money(analytics.martingale.observed)}</p><span className="ok">95% CI {money(analytics.martingale.low)} to {money(analytics.martingale.high)}</span></div></div></section>
    </div>
  </LabShell>;
}

function Field({ id, label, value, onChange, suffix, min, max, step = "any" }: { id: string; label: string; value: string; onChange: (value: string) => void; suffix?: string; min?: string; max?: string; step?: string }) {
  return <label className="field" htmlFor={id}><span>{label}</span><div className="input-wrap"><input id={id} type="number" value={value} min={min} max={max} step={step} onChange={event => onChange(event.target.value)} />{suffix && <i>{suffix}</i>}</div></label>;
}

function Spark({ data, label }: { data: number[]; label: string }) {
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const points = data.map((value, index) => `${(index / (data.length - 1)) * 100},${96 - ((value - min) / range) * 82}`).join(" ");
  return <div className="spark-wrap"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={label}><polyline points={points} fill="none" stroke="#65d6bd" strokeWidth="1.8" vectorEffect="non-scaling-stroke" /></svg><div className="spark-label"><span>{money(min)}</span><span>{money(max)}</span></div></div>;
}

