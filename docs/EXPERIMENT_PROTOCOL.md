# Experiment protocol

> **Scope note.** This document describes the V1 experiment (100 seeds, `lib/*.ts`, `benchmarks/baseline-backtest.json`).
> It is kept for history. The shipped V2 experiment lives in `lib/research/` and `benchmarks/research-v2.json`;
> see [`../README.md`](../README.md) and [`RESEARCH_CONSTITUTION.md`](RESEARCH_CONSTITUTION.md) for current numbers.

Preregister the hypothesis, scenario, parameters and seed before viewing results. Preserve the decision-time information set, action, book state, inventory, model assumptions and later markout. Compare strategies on identical seeded event streams. Report costs, fills, drawdown, inventory, Greeks, regret and uncertainty; do not annualize short intraday Sharpe ratios.

The corrected benchmark uses option fair value for option quotes and marks, with a separate underlying hedge book. Across 100 synthetic seeds, delta hedging reduces mean maximum residual delta from 458.26 to 0.49 and improves the 0.50-spread worst seed from -$21,053.45 to -$1,940.12 at $25.26 mean hedge fees. Adverse-aware widening produces $643.88 mean net P&L and -$734.55 worst seed. These are risk/cost diagnostics, not profitability claims.

Decision replay stores the information set before the action separately from realized flow and subsequent mark. Counterfactual regret is ex-post diagnostic regret over a predefined feasible action set; it is not achievable foresight.

The stress suite reuses identical seed IDs across declared environments and reports mean, median, fifth percentile, worst seed, negative-seed rate, and deterministic bootstrap intervals. Resampling is a sensitivity diagnostic because seeded paths are not independent market observations.

The untouched-selection protocol partitions seeds 1–100 into train (1–60), validation (61–80), and final test (81–100). It selects among three fixed policies using only `mean net P&L + 0.25 × P05 net P&L`; the corrected run selects delta hedging and reconciles both untouched splits.

The `/inference` implementation is a compact centered max-mean bootstrap over three policies: 100 common seeds, 2,000 deterministic resamples, observed maximum mean net P&L $1,650.61, and p ≈ 0.0010. It is a synthetic data-snooping diagnostic, not formal live-data inference. For dependent event-time rewards, use the separate stationary-bootstrap implementation and calibrate it to timestamped observations.
