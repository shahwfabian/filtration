# Devpost Submission Package

This package is based on the merged V2 release in [PR #2](https://github.com/shahwfabian/filtration/pull/2). It separates current submission evidence from the superseded V1 work.

## Copy-ready Devpost entry

**Title:** Filtration | Synthetic Options Market-Making Research Lab

**Tagline:** Explore how inventory, informed order flow, and trading frictions shape option quotes.

**Description**

Filtration is an interactive research lab for studying how an options market maker can quote while managing inventory and adverse selection. It simulates a European call market with informed and uninformed customers, quote latency, queue position, and delta hedging with spread, impact, and fees.

The experiment compares three quoting policies on the same 1,000 deterministic sessions, split into training, validation, and untouched final seeds. On the 200 final sessions, the inventory- and toxicity-aware policy produced a mean paired net P&L difference of **$72.91** versus symmetric unhedged quoting, with a 95% paired-bootstrap interval of **[$48.56, $96.49]**.

The attribution analysis adds necessary context: most of the gain is explained by hedging and wider quotes. A symmetric hedged quote of comparable width performed similarly to the adaptive policy on development seeds. Extreme toxicity and volatility-crisis tests also expose material losses. The results are synthetic research evidence, not historical or live trading performance, and the project’s evidence tribunal blocks deployment.

**Inspiration**

Market-making results depend on more than the quote price. Inventory, informed customers, delayed execution, queue position, and hedge costs can change the outcome. Filtration makes those assumptions visible so a strategy can be examined under controlled conditions.

**How it was built**

The simulator uses seeded TypeScript scenarios and a Next.js interface. It keeps option and underlying positions separate, applies risk-neutral pricing to the option and declared physical dynamics to the simulated market, and evaluates policies on shared event streams. A generated artifact supplies the displayed results; an evidence tribunal checks the experiment outputs and release gates.

**What we learned**

The headline difference alone does not identify why a policy performed better. In this experiment, hedging and spread width explain most of the gain; the separate contribution of inventory skew is small, and hostile conditions still create substantial downside.

## Evidence map

| Submission claim | Source of truth |
| --- | --- |
| Held-out result, interval, win rate, and seed split | [V2 benchmark artifact](../benchmarks/research-v2.json) and [README](../README.md) |
| Research gates, accounting, inference, and browser verification | [V2 release review](RELEASE_REVIEW_V2.md) |
| Model assumptions and prohibited claims | [Research constitution](RESEARCH_CONSTITUTION.md) |
| V1/V2 evidence boundary | [Resume evidence](RESUME_EVIDENCE.md) |

PR #1 and the old V1 experiment are superseded. Do not use their implementation or V1 numbers as submission evidence. The V1 protocol is retained for history and labeled as such in [Experiment Protocol](EXPERIMENT_PROTOCOL.md).

## Before publishing

- Add a live URL that serves the V2 release. The V2 release review records that a hosted preview was pending.
- Capture screenshots or a short demo from the V2 routes, such as Research Overview, Policy Comparison, Stress Laboratory, or Evidence Tribunal.
- Do not advertise an automated test count until the snapshots are reconciled: the release review, PR #2 description, and resume evidence record 43, 44, and 49 tests, respectively.
