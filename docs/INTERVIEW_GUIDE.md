# Interview guide

> **Scope note.** The Strategy and Stress figures quoted here come from the V1 experiment (100 seeds).
> It is kept for history. The shipped V2 experiment lives in `lib/research/` and `benchmarks/research-v2.json`;
> see [`../README.md`](../README.md) and [`RESEARCH_CONSTITUTION.md`](RESEARCH_CONSTITUTION.md) for current numbers.

Be prepared to explain why discounted tradable prices are Q-martingales, how the measure change affects drift, how Itô’s lemma yields the hedge terms, why Monte Carlo is O(M^-1/2), and why a good decision can lose money. The Strategy and Stress Laboratories add the important follow-up: a policy with lower mean P&L can have better tail outcomes, while doubled volatility can raise mean synthetic P&L and still worsen the negative-seed rate. The implementation is a research instrument, not a profitability claim.
