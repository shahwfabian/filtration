# Strategy Tribunal

> **Scope note.** This document describes the V1 experiment (100 seeds, `lib/*.ts`, `benchmarks/baseline-backtest.json`).
> It is kept for history. The shipped V2 experiment lives in `lib/research/` and `benchmarks/research-v2.json`;
> see [`../README.md`](../README.md) and [`RESEARCH_CONSTITUTION.md`](RESEARCH_CONSTITUTION.md) for current numbers.

The tribunal is an evidence-based audit, not an LLM opinion. It checks leakage, impossible fills, missing costs, accounting reconciliation, multiple testing, walk-forward integrity, seed robustness and stress scenarios. Verdicts are PASS, PASS WITH WARNINGS, INSUFFICIENT EVIDENCE, or FAIL, each backed by stored findings with an ID, severity, evidence string, and remediation.

The seeded fixtures prove the tribunal catches look-ahead leakage and impossible/unreconciled fills. A negative worst-seed P&L is retained as an INFO finding rather than treated as an implementation failure; the system must distinguish economic weakness from invalid plumbing.
