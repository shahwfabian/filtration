# Decision Autopsy

> **Scope note.** This document describes the V1 experiment (100 seeds, `lib/*.ts`, `benchmarks/baseline-backtest.json`).
> It is kept for history. The shipped V2 experiment lives in `lib/research/` and `benchmarks/research-v2.json`;
> see [`../README.md`](../README.md) and [`RESEARCH_CONSTITUTION.md`](RESEARCH_CONSTITUTION.md) for current numbers.

Decision replay preserves two distinct records:

1. `DecisionInformation`: the mid, inventory, base spread, volatility, and posterior available before the action.
2. `ScenarioOutcome`: the realized flow side, arrival draw, next mark, fees, and multiplier observed after the action.

The action set is generated before the outcome is evaluated. Feasibility uses only the decision-time inventory limit. Utility is realized mark-to-market P&L minus execution fees and a quadratic inventory penalty. Regret is the difference between the best feasible action under the realized scenario and the selected action:

`regret = max_feasible utility − selected utility`.

This is explicitly ex-post diagnostic regret, not achievable foresight. The luck contribution compares realized utility with the selected action's decision-time expected utility. A losing action can therefore be a good decision when its expected utility was strong but the realized mark moved against it.
