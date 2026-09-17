# Handoff — session 1 (2026-09-17): trustworthy baseline

Prepared by Claude (AI coding assistant) working for Shah Wasif Fabian. Everything marked
**verified** was produced by a command run in this session. Everything else is labelled.

## Starting point

- Repository: `https://github.com/shahwfabian/filtration`, freshly cloned (no local checkout existed).
- Starting branch and commit: `agent/options-market-making-lab` @ `76dcfd9575077b1cdafc2c1bb278d6e90ce75c68`.
  Clean working tree. Other remote branches: `main` (V1, `29c0203`), `codex/research-rebuild-v2`.
- Working branch: `claude/baseline-audit` (local only; not pushed).
- The committed artifact recorded `codeCommit 2b02274`. `git diff 2b02274 76dcfd9 -- lib scripts tests`
  is empty, so the research code was unchanged between generation and release (**verified**).

## Environment

| Item | Repository evidence | Used here |
| --- | --- | --- |
| Package manager | `pnpm-lock.yaml` v9; CI `pnpm/action-setup` v9 | pnpm 9.15.9 via `corepack pnpm@9` |
| Node | CI `node-version: 22`; no `engines` field | Node 24.15.0 (**Node 22 not tested locally**) |
| Framework | Next.js 15.5.9, React 19.1.1, TypeScript 5.9.3 (locked) | same, `--frozen-lockfile` |
| OS | CI ubuntu-latest | Windows 11 |

The README says `npm install`; that does not honour the pnpm lockfile. `CLAUDE.md` records the pnpm commands.
**Résumé discrepancy:** the project uses Next.js **15.5.9**, not 16. It was not upgraded.

## Baseline reproduction (before any code change, **verified**)

| Command | Result |
| --- | --- |
| `corepack pnpm@9 install --frozen-lockfile` | ok, 1 m 16 s |
| `corepack pnpm@9 test` | **44 passed, 0 failed** (release review says 43) |
| `corepack pnpm@9 run research:v2` | ok, ~9 s; artifact **identical** to the committed one except `generatedAt`, `codeCommit`, `branch` |
| `corepack pnpm@9 run build` | ok; 12 static routes (10 lab pages, `/learn`, `/_not-found`) |

Seed configuration: seeds 1–600 train, 601–800 validation, 801–1000 final; seed-manifest hash
`0de41d33d8e4…`; config hash `b447e5e85482…`; bootstrap seeds 8117 (paired CI) and 7701 (Reality Check), 2,000 resamples.

Final split, adaptive (`INVENTORY_TOXICITY_AWARE`) minus `BASELINE`: mean **$72.9104**, 95% paired
percentile bootstrap **[$48.5556, $96.4905]**, seed win rate **65.5%**. README claims reproduce exactly.
Delta-hedged minus baseline: $25.21 [$2.79, $47.37]. Train Reality Check p = 0.0005 (seeds 1–600).
Tribunal verdict: `RESEARCH PASS · DEPLOYMENT BLOCKED`.

The original artifact is preserved in git at `76dcfd9:benchmarks/research-v2.json`.

## Confirmed defects

1. **Reconciliation and liquidation gates could not fail** (fixed this session). `simulate.ts` compared
   `netPnl` with the identical expression used to compute it; `finalOptionInventory`/`finalUnderlyingInventory`
   were the literal `0`; `policySeedCount` and `policiesUseCommonSeeds` were constants in the runner.
   The "3,000 / 3,000 reconciled" evidence and the UI labels "RECONCILED"/"PASSED" were therefore assertions.
2. **Sub-tick liquidation cash is dropped** (exposed by fix 1; **not fixed**). When a long call is worth less
   than one tick, `simulate.ts` sells at `max(tick, call − halfSpread)` = $0.01 but books cash at the model
   value and clips the negative "cost" to 0. Reported net P&L is understated by up to $12.64 per run.
   Affected: `EXTREME_TOXICITY`, 23 of 200 stress seeds, all three policies; the artifact now shows
   `reconciled: false` for that regime. Base-config runs reconcile to 3.1e-11 dollars.
3. **Option position limit can be exceeded by latency.** Quotes are sized against inventory at decision
   time but fill one step later. Base config: |inventory| reached 13 vs limit 12 in 12 of 3,000 runs
   (seeds 3, 115, 575, 789, 921 for symmetric policies; 575, 789 adaptive). Seed 921 is a final seed.
   Whether the limit should bind at decision or at execution is a spec question for the owner.
4. **Latency parameters are not validated.** `hedgeLatencySteps` of 0 or a non-integer silently drops every
   hedge (seed 3: max |delta| 796.7 vs 70.1). Defaults (1) are unaffected.
5. **Stale V1 documents.** `docs/RESUME_EVIDENCE.md` bullets (100 seeds, −$21,053 worst seed, 28 tests),
   `EXPERIMENT_PROTOCOL.md`, `MARKET_MICROSTRUCTURE.md`, and `INTERVIEW_GUIDE.md` describe V1, not V2.
6. **Remaining hard-coded display text:** "600 / 200 / 200" (`app/validation/page.tsx`), "200 final scenarios"
   (`app/strategy/page.tsx`); `invariants.pairedBootstrapPreserved` and `pairingPreserved` are literal `true`.

## Audit of research mechanics

Verified by reading code plus the checks named. "OK" means no defect was found, not that the model is realistic.

| Area | Finding |
| --- | --- |
| Q vs P | OK. `scenario.ts` evolves spot with `physicalDrift`; `policy.ts` prices with `rate`/`dividend` only. |
| Decision-time information | OK. Quotes use spot, vol, inventory, and a posterior updated only after each step. |
| Informed flow | OK. Regime at *t* sets customer side and the *t→t+1* return; existing test confirms positive signed return. |
| Inventory skew sign | Correct sign (long lowers reservation price). **Magnitude ≈ $0.0019 at inventory 11, below the $0.01 tick.** |
| Latency / queue / size | Quotes active after 1 step; queue-ahead and order size bind. Queue is independent of quote price. See defect 3. |
| Hedges | Cross half-spread + linear impact + per-share fee after latency; impact is temporary. See defect 4. |
| Liquidation / cash | Ledger rebuild matches for base config; see defect 2. |
| Common random numbers | OK. One scenario per seed shared by all policies; replay actions share one event. |
| Bootstrap | OK. Seed is the resampling unit; pairing preserved; percentile CI; Reality Check uses one shared index vector. |
| Artifact → UI | Values imported from JSON; see defect 6. |

### Suspected issues / research-design findings (not code defects)

- **The headline effect is mostly hedging plus a wider spread, not toxicity awareness.** Train seeds only,
  exploratory diagnostic, not model selection: removing inventory skew changes adaptive P&L by −$0.07
  [−0.20, 0.06]; a symmetric delta-hedged policy quoting ±$0.18 (the adaptive policy's mean half-spread)
  earns $182.48 vs adaptive $181.00, difference −$1.48 [−4.62, 1.47]. Consequence: the $72.91 comparison
  bundles three changes (hedging, wider quotes, directional widening) against one benchmark. Unverified on
  validation; **must not be checked on final seeds**.
- **LCG seeding.** `SeededRandom(seed)` with seeds 1…1000 makes the k-th draw of seed s+1 a fixed shift of
  seed s's (draw-1 correlation 1.00, draw-2 0.51, draw-10 0.67), and no scenario starts informed at t = 0.
  Autocorrelation of paired P&L differences across consecutive seeds is negligible (lag 1 = 0.021, within
  ±0.063), so no inference impact is demonstrated. Changing the generator would change every result.
- Filter likelihood is fixed (`toxicity.ts`: return sd 0.004 vs generator one-step sd ≈ 0.0007; transition 0.82)
  and is misspecified under stress regimes by design. Reality Check on `/inference` is from the train split
  but the page does not say so. The artifact lacks the test results that constitution §10 requires, and
  `codeCommit` cannot detect a dirty tree.

## Change made this session

Commit `506e1ae` — *reconcile research runs from an execution ledger*:

- `lib/research/simulate.ts`: every customer fill, hedge, and liquidation is appended to `ledger`;
  `reconcileLedger` rebuilds positions and cash independently; `finalOptionInventory`,
  `finalUnderlyingInventory`, `reconciled`, and new `reconciliationError` come from it (tolerance $1e-6).
- `lib/research/evaluate.ts`: `deriveEvidenceCounts` counts reconciled, flat, and per-policy runs from rows and
  checks seed alignment; `scripts/run-research-v2.mjs` uses it.
- `app/page.tsx`, `app/strategy/page.tsx`: reconciliation labels read from artifact counts.
- Tests: 3 new tests (ledger rebuild across seeds/policies; tampered cash, missing hedge, missing liquidation
  must fail; tampered panel rows must lower evidence counts). On the original commit these files fail to load.

Verification (**verified**): 47 passed / 0 failed; build ok; `/` and `/strategy` rendered in a local dev server
with no console errors. Regenerated artifact (commit that follows `506e1ae`): all P&L, interval, split, and
stress numbers identical to the original; differences are metadata, two new evidence fields, and
`reconciled: false` for the three `EXTREME_TOXICITY` summaries (defect 2). Tribunal verdict unchanged.

## Blockers / not done

- Nothing pushed or deployed. Hosted preview verification remains pending (see `RELEASE_REVIEW_V2.md`).
- Node 22 (CI version) not run locally; CI not triggered.

## Next specific task

Decide how sub-tick liquidation should be priced (defect 2), then fix it with a regression test.
Recommendation: sell long options at `max(0, call − halfSpread)` (no bid below fair value) and record
the ledger price accordingly, so `liquidationCost ≥ 0` holds without clipping. This changes only
`EXTREME_TOXICITY` stress values; record before/after in this file. After that: validate latency
parameters (defect 4), then write a preregistered ablation protocol for the attribution question using
fresh seeds (e.g. 1001–1400), without touching seeds 801–1000.
