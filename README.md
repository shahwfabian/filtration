# Filtration

A reproducible synthetic research environment for European option market making under inventory risk,
directional adverse selection, quote latency, queue position, and frictional delta hedging.

The name comes from the filtration \(\{\mathcal{F}_t\}_{t \ge 0}\) in stochastic processes: the information
available to a trader through time. Every policy in this laboratory must be measurable with respect to the
information available at its decision time.

## Research question

How should an option market maker quote when inventory risk and informed customer flow arrive together?

A simulated market maker quotes a 30-day at-the-money call over 120 one-minute steps. Some customers are
uninformed; others know the direction of the next move. Three quoting policies trade the identical 1,000
seeded sessions, so differences between them come from the policy and not from the draw:

1. Symmetric, unhedged quoting (the declared benchmark).
2. Symmetric quoting with frictional delta hedging.
3. Inventory-skewed, directionally toxicity-aware quoting with frictional delta hedging.

## What the evidence says

On the 200 final seeds, evaluated once and never tuned on, the adaptive policy's mean paired net-P&L
difference versus the symmetric unhedged benchmark is `$72.91`, with a paired bootstrap 95% interval of
`[$48.56, $96.49]`, beating the benchmark on `65.5%` of sessions.

Most of that gap is hedging plus a wider quote rather than the adaptive mechanism itself. On the 600
training seeds:

| Question | Mean difference | 95% paired CI |
| --- | --- | --- |
| What does delta hedging add to symmetric quoting? | `$28.88` | `[$12.33, $46.89]` |
| What do inventory skew and toxicity premiums add to a hedged book? | `$47.09` | `[$43.54, $50.83]` |
| What does the inventory skew add on its own? | `−$0.07` | `[−$0.20, $0.06]` |
| Does directional quoting beat a symmetric hedged quote of the same average width (±$0.18)? | `−$1.48` | `[−$4.62, $1.47]` |

So the honest reading is: **hedging removes most of the left tail, and the rest of the improvement is
explained by quoting wider.** The inventory skew is smaller than one tick at the configured risk aversion.
This breakdown is exploratory and uses development seeds only; the final seeds were not reused to test it.
The Evidence Tribunal reports it as finding `T-006`.

This is mechanism evidence inside a declared simulator. It is not a claim of historical alpha or live
profitability. The hostile regimes show material losses under extreme toxicity, wide underlying markets, and
volatility crisis conditions, so the Tribunal returns `RESEARCH PASS · DEPLOYMENT BLOCKED`.

## What makes the experiment coherent

- The underlying price and European call are separate instruments.
- Black-Scholes valuation operates under `Q`; the synthetic trading environment evolves under declared `P` dynamics.
- A latent informed-flow regime predicts the subsequent state move and is hidden at decision time.
- Quotes activate after latency and face customer reservation prices, queue-ahead quantity, and finite market-order size.
- Underlying hedges cross a spread and pay market impact plus fees after hedge latency.
- Option and underlying inventory are forcibly liquidated at termination.
- Every run is reconciled by rebuilding positions and cash from its own execution ledger.
- Policy comparisons use common random numbers and paired bootstrap indices.
- Counterfactual actions face the same latent event; expected utility cannot read realized outcomes.
- The Evidence Tribunal recomputes content hashes and evidence counts, then fails closed on inconsistencies.

The binding assumptions and release gates are in [`docs/RESEARCH_CONSTITUTION.md`](docs/RESEARCH_CONSTITUTION.md).
Known open issues are tracked in [`docs/HANDOFF.md`](docs/HANDOFF.md).

## Reproduce

The lockfile is pnpm's. CI runs pnpm 9 on Node 22; `npm install` ignores the lockfile.

```bash
corepack pnpm@9 install --frozen-lockfile
corepack pnpm@9 run research:v2   # regenerates benchmarks/research-v2.json
corepack pnpm@9 test
corepack pnpm@9 run build
corepack pnpm@9 run dev
```

`research:v2` regenerates [`benchmarks/research-v2.json`](benchmarks/research-v2.json) from 1,000
deterministic scenarios split into 600 train, 200 validation, and 200 final seeds. Every number rendered by
the interface is read from that artifact.

## Product workflow

- Research Overview: question, findings, architecture.
- Pricing Laboratory: Black-Scholes, Greeks, antithetic Monte Carlo, P/Q path distinction.
- Trading Arena: a no-foresight sequential quoting game with realized regret.
- Policy Comparison: held-out panel plus the attribution breakdown.
- Stress Laboratory: declared failure regimes, not only favorable cases.
- Untouched Validation: frozen 600/200/200 seed manifest.
- Paired Inference: benchmark-relative family-wide Reality Check on the training split.
- Decision Autopsy: same-event counterfactual replay.
- Evidence Tribunal: derived findings and deployment gate.
- Methodology: model card, limits, and reproduction commands.

## Scope

No live data, brokerage credentials, historical performance, live routing, or profitability claim is present.
The old V1 artifacts remain in the repository for comparison; the V2 interface reads only the generated
`research-v2.json` artifact. Parts of this repository were written with AI coding assistance; the research
design, the checks, and the claims are the author's responsibility.
