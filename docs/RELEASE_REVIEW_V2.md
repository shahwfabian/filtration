# V2 Release Review

## Scope

This review covers the Filtration release candidate prepared on `codex/research-rebuild-v2`.

## Quantitative gates

- Separate option and underlying instruments: passed.
- Risk-neutral valuation separated from physical scenarios: passed.
- Informed flow predicts a subsequent state move: passed.
- Directional toxicity and inventory skew: passed.
- Quote and hedge latency: passed.
- Queue-ahead and finite order size: passed.
- Hedge spread, impact, and fees: passed.
- Mandatory option and underlying liquidation: passed.
- Cash reconciliation: 3,000 / 3,000 research runs.
- Terminal flat inventory: 3,000 / 3,000 research runs.
- Common-seed pairing and paired bootstrap: passed.
- Same-event counterfactual replay without outcome leakage: passed.

## Engineering gates

- Unit and adversarial tests: 43 passed, 0 failed.
- TypeScript validation: passed.
- Next.js production build: passed.
- Static generation: 10 product routes plus framework routes passed.
- Production HTTP smoke test: all 10 product routes returned HTTP 200 with non-empty rendered HTML.
- Invalid pricing inputs: rejected before the numerical engine is called.
- Browser acceptance: all 10 product routes returned HTTP 200 in headless Chromium with zero page or console errors.
- Desktop layout: all 10 routes rendered without horizontal overflow at 1,440 × 1,000.
- Mobile layout: all 10 routes rendered without horizontal overflow at 390 × 844 and exposed the mobile research navigation.
- Pricing interaction: invalid spot input produced a controlled validation message; a valid configuration recomputed the path; P/Q measure switching updated the path label.
- Arena interaction: a selected quote revealed the previously hidden customer event and next state, then advanced to the next round.
- Stress and autopsy interactions: scenario selection changed the reported regime evidence and timeline selection changed the inspected decision.
- Frontend benchmark provenance: V2 benchmark values are imported from `benchmarks/research-v2.json`.

## Hosted-preview constraint

The current Vercel project has no branch-preview deployment for this rebuild. Its generic deployment action does not expose a preview-only guarantee, so it was not invoked: preserving the existing production alias takes priority. The branch is therefore browser-verified against its production build locally, while hosted verification remains pending a preview-scoped deployment.

## Adversarial verdict

Research pass, deployment blocked. Extreme persistent toxicity, wide underlying markets, and volatility-crisis scenarios expose material left-tail risk. Historical replay and forward paper trading remain required before any empirical market claim.
