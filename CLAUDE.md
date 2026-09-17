# Filtration — agent instructions

Synthetic research lab for European option market making under inventory risk, informed flow,
latency, and frictional delta hedging. Binding spec: `docs/RESEARCH_CONSTITUTION.md`.
Session log and open issues: `docs/HANDOFF.md`.

## Verified setup (2026-09-17, Windows 11, Node 24.15.0)

The lockfile is `pnpm-lock.yaml` (v9). CI uses pnpm 9 on Node 22. Do not run `npm install`:
it ignores the pnpm lockfile and creates an untracked `package-lock.json`.

```bash
corepack pnpm@9 install --frozen-lockfile
corepack pnpm@9 test               # node --test, ~5 s
corepack pnpm@9 run research:v2    # regenerates benchmarks/research-v2.json, ~10 s
corepack pnpm@9 run build          # next build into .next-build/, ~2 min
corepack pnpm@9 run dev            # next dev into .next-dev/
```

Scripts use `node --experimental-strip-types` to import `.ts` directly; that needs Node ≥ 22.6.

## Architecture boundaries

- **V2 (live product):** `lib/research/*`, `scripts/run-research-v2.mjs`,
  `benchmarks/research-v2.json`, tests `research-*.test.mjs`, and every page in `app/`.
- **Shared:** `lib/quant.ts` (Black–Scholes, Monte Carlo) is used by V2 `policy.ts` and `/pricing`.
- **V1 (legacy, not rendered):** `lib/{adverse,backtest,dependence,exchange,multipleTesting,replay,stress,tribunal,validation}.ts`,
  the other `scripts/run-*.mjs`, the other `benchmarks/*.json`, and their tests.
  `lib/replay.ts` ≠ `lib/research/replay.ts`, and `lib/tribunal.ts` ≠ `lib/research/tribunal.ts`.
- Several docs still describe V1 numbers (`EXPERIMENT_PROTOCOL.md`, `RESUME_EVIDENCE.md`,
  `MARKET_MICROSTRUCTURE.md`, `INTERVIEW_GUIDE.md`). Do not quote them as V2 results.
- Pipeline: `generateScenario` (P-measure states + latent events, one per seed) →
  `simulatePolicy` for each policy on the same scenario → `runResearchPanel` → paired bootstrap /
  Reality Check → artifact JSON → `adjudicate` (Tribunal) and static pages.

## Research-integrity rules

- Final seeds 801–1000 have already been evaluated. Never tune on them. Any new model selection
  needs a written protocol and a fresh held-out seed set; keep the original artifact for comparison.
- Do not change the simulator, seeds, bootstrap, or gates to make a number or a test agree.
  A change that moves any benchmark value needs a documented reason in `docs/HANDOFF.md`.
- Displayed results must be read from `benchmarks/research-v2.json`; never hard-code them in `app/`.
- Evidence must be derived, not asserted: no literal `true`/`0` standing in for a check.
- Policies may read only decision-time state (spot, volatility, inventory, posterior). Event side,
  latent regime, next spot, and next volatility are prohibited policy inputs.
- Keep unfavorable stress results visible. Keep "RESEARCH PASS · DEPLOYMENT BLOCKED" unless new,
  documented evidence changes it. Hosting the demo is not deploying a trading strategy.
- Synthetic results are not historical alpha or live profitability; say so wherever they appear.
- Regenerate the artifact from a committed tree so `codeCommit` identifies the code that produced it.
- No secrets, brokerage connections, pushes, merges, or deployments without the owner's instruction.
