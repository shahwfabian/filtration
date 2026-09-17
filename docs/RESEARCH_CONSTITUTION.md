# Filtration Research Constitution

Status: binding specification for the Filtration release.

## 1. Research question

How should an electronic market maker quote a European option when option inventory,
underlying hedge friction, directional adverse selection, and volatility uncertainty are
simultaneously present?

The project is a controlled synthetic experiment. It does not claim historical or live
profitability.

## 2. Traded instruments

The simulator contains two distinct instruments:

- An underlying asset with price `S_t`.
- A European call option with value `C(S_t, K, tau_t, sigma_t)`.

The option exchange quotes around the option value. Delta hedges trade in the underlying.
Option inventory and underlying inventory are accounted for separately.

No implementation may mark an option position against the underlying price.

## 3. Measures and models

Black-Scholes valuation uses the risk-neutral measure `Q`:

`C_t = exp(-r tau) E^Q[(S_T - K)^+ | F_t]`.

The synthetic trading environment evolves under a declared physical measure `P`. The
physical drift is a scenario parameter. It must never be silently substituted into option
valuation.

Volatility is stateful and observable to the market maker at decision time. Future price,
future volatility, latent customer direction, and latent customer aggressiveness are not
decision-time fields.

## 4. Customer flow and adverse selection

Every time step is generated from one latent event record before any policy is evaluated.
The record contains random shocks, customer direction, and customer reservation distance.
All policies and counterfactual actions face the same record.

An informed customer must have measurable information about a subsequent spot or
volatility move. A label uncorrelated with future state is not informed flow.

Fill probability is parameterized as `lambda(delta) = A exp(-k delta)`. `A` controls arrival
frequency. `k` controls quote-distance sensitivity. The two parameters may not be conflated.

## 5. Quoting policy

The reference adaptive policy must contain:

- A theoretical option value.
- An inventory-dependent reservation price.
- Direction-specific toxicity premiums.
- Explicit tick rounding.

Long option inventory must move the quote center downward. Short inventory must move it
upward. Estimated informed buying may widen the ask independently of the bid; estimated
informed selling may widen the bid independently of the ask.

## 6. Execution and hedging

Option quotes have declared latency and queue-ahead quantity. A fill cannot occur before a
quote becomes active. Counterfactual fills are determined from the shared latent customer
event.

Underlying hedges execute after declared latency at the bid or ask. Hedge fees and market
impact are charged explicitly. Midpoint hedge execution is prohibited.

Every run ends with mandatory liquidation of remaining option and underlying inventory.

## 7. Accounting

Net P&L must reconcile from cash after terminal liquidation. The report must separately
identify option execution cash, hedge execution cash, fees, and liquidation costs.

The simulator must retain delta, gamma, and vega exposure histories. A delta-only risk label
is insufficient for an options market-making experiment.

## 8. Statistical protocol

Policies are compared with common random numbers. Paired policy differences are the
primary estimand.

Any Reality Check or Superior Predictive Ability test must operate on policy-minus-benchmark
loss differentials. Bootstrap resampling must preserve cross-policy pairing.

Ordered event streams use a block-based bootstrap. Independent scenario seeds may use an
iid bootstrap. The interface must identify which assumption applies.

The final seed manifest is immutable after evaluation. Tail estimates must disclose sample
size and uncertainty.

## 9. Counterfactual replay

Expected utility may use decision-time state and model parameters only. Realized customer
direction, next price, and next volatility are prohibited inputs.

Ex-post regret is:

`R_t = max_{a in A_t} U_t(a; omega_t) - U_t(a_selected; omega_t)`.

Every action in `A_t` must be feasible under the same position limits and face the same
latent outcome `omega_t`.

## 10. Evidence and Tribunal

The Tribunal may not accept self-reported booleans as proof. Findings must be derived from
versioned artifacts containing the code commit, configuration hash, seed-manifest hash,
test results, benchmark outputs, and reconciliation results.

Displayed benchmark values must be loaded from generated artifacts. Hardcoded benchmark
numbers in React components are prohibited.

## 11. Product requirements

The live product must provide a clear research overview before opening the laboratory. All
controls require semantic labels and bounded input domains. Invalid inputs must never crash
the application.

Navigation must remain available on mobile. Mathematical symbols must pass a deployed
UTF-8 browser test.

## 12. Rejection gates

A release is rejected if any of the following is true:

- The option is marked against the underlying price.
- Informed flow is uncorrelated with future state.
- Hedges execute at an unfrictional midpoint.
- Terminal inventory is not liquidated.
- Counterfactual actions receive different latent events.
- A statistical resample breaks policy pairing.
- A displayed result is manually duplicated in frontend source.
- An invalid numeric input causes an uncaught exception.
- A deployed mathematical symbol is corrupted.
