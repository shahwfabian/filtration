# Market microstructure

> **Scope note.** This document describes the V1 experiment (100 seeds, `lib/*.ts`, `benchmarks/baseline-backtest.json`).
> It is kept for history. The shipped V2 experiment lives in `lib/research/` and `benchmarks/research-v2.json`;
> see [`../README.md`](../README.md) and [`RESEARCH_CONSTITUTION.md`](RESEARCH_CONSTITUTION.md) for current numbers.

The implemented exchange uses price-time priority, explicit order arrival/cancellation latency, partial fills, tick size, multiplier, fees, position limits, and deterministic event ordering. A price touch does not imply a fill. The baseline uses synthetic spread-dependent arrival probability `exp(-3 × spread)` because there is no calibrated market feed.

The backtest now quotes and marks a Black–Scholes option fair value; the underlying GBM path is used for the option’s spot input and for a separate delta hedge. This boundary matters: the old spot-as-option implementation was economically invalid, so all benchmark artifacts were regenerated.

The model is informed by Avellaneda & Stoikov’s inventory-aware limit-order-book framework and Cont, Kukanov & Stoikov’s separation of limit orders, market orders, and cancellations. Those references motivate simulator boundaries; they do not validate the synthetic scenario or imply profitability.

The adverse-selection filter keeps uninformed, informed-buy, and informed-sell regimes and updates only from decision-time evidence. Post-fill markouts remain diagnostics and are not fed into the same decision before they become observable.

Persistent-flow stress uses 85% regime persistence and 35% buy-side bias. Under the corrected hedged/adverse-aware policy it produces $620.65 mean net P&L, 15% negative seeds, and a -$745.29 worst seed across 100 synthetic seeds. These controls are not empirical calibration; the next gate is fitting arrival, sign-persistence, and markout distributions to timestamped event data.

Primary references:

- Avellaneda & Stoikov, [High-frequency trading in a limit order book](https://people.orie.cornell.edu/sfs33/LimitOrderBook.pdf).
- Cont, Kukanov & Stoikov, [The Price Impact of Order Book Events](https://arxiv.org/abs/1011.6402).
