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
2. **Sub-tick liquidation was priced inconsistently** (exposed by fix 1; **fixed**, see below). When a long
   call was worth less than one tick, `simulate.ts` executed at `max(tick, call − halfSpread)` = $0.01 but
   booked cash at the model value and clipped the negative "cost" to 0. Booked cash and the executed price
   disagreed by up to $12.64 per run. Affected: `EXTREME_TOXICITY`, 23 of 200 stress seeds, all three policies.
   Base-config runs were unaffected (reconcile to 3.1e-11 dollars).
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
with no console errors. Regenerated artifact (commit `fb91988`): all P&L, interval, split, and
stress numbers identical to the original; differences are metadata, two new evidence fields, and
`reconciled: false` for the three `EXTREME_TOXICITY` summaries (defect 2). Tribunal verdict unchanged.

Commit `a709aa6` — *liquidate sub-tick long options at zero* (owner-approved recommendation):

- A long option now liquidates at `max(0, call − terminalOptionHalfSpread)`: with no bid above fair value it
  cannot sell for a tick more than it is worth. `liquidationCost` is `midCash − actualCash` without clipping;
  it is non-negative by construction for both long and short inventory.
- Regression test uses **training** seed 35 under the `EXTREME_TOXICITY` parameters (terminal call below one
  tick, all three policies long): the ledger price must be 0, the run must reconcile, and liquidation cost must
  include the forgone model value. It failed before the fix (`actual: 0.01`) and passes after.

Verification (**verified**): 48 passed / 0 failed; build ok. Evidence regenerated in commit `230a665`.
Config hash, seed manifest, train, validation, and final results are byte-identical to the previous artifact;
3,000 / 3,000 base runs reconcile; Tribunal still `RESEARCH PASS · DEPLOYMENT BLOCKED` (score 83).
Only the `EXTREME_TOXICITY` stress summaries changed (final seeds 801–1000, evaluated as before, not tuned):

| Policy | Mean net P&L | Median | Mean liquidation cost | Reconciled |
| --- | --- | --- | --- | --- |
| BASELINE | −3,433.44 → −3,434.86 | −1,127.56 → −1,133.06 | 45.85 → 47.27 | false → true |
| DELTA_HEDGED | −171.14 → −172.55 | −176.22 (same) | 59.89 → 61.31 | false → true |
| INVENTORY_TOXICITY_AWARE | 105.65 → 104.48 | 163.44 → 161.44 | 46.41 → 47.58 | false → true |

P05, worst seed, and negative-seed rate are unchanged for all three. P&L falls slightly because the
previous accounting kept each sub-tick call's model value as cash while charging no liquidation cost.

Commit `680e9e1` — *explain the result in plain language and attribute the improvement*:

- New `lib/research/attribution.ts`: a train-split decomposition (hedging; adaptive quoting over a hedged
  book; inventory skew alone; adaptive versus a symmetric hedged quote matched to the adaptive policy's mean
  half-spread, $0.18). Stored at `train.attribution` in the artifact. Fixed variants only; nothing is selected
  or tuned, and the final seeds are not reused.
- `lib/research/tribunal.ts`: finding **T-006** (MEDIUM) fires when the inventory-skew or width-matched
  interval includes zero. It fires on the current evidence, so the score drops 83 → 75; verdict unchanged.
- Interface: overview rewritten as plain-language findings; Policy Comparison shows the attribution table;
  `/inference` is labelled as the training split; the last hard-coded counts are derived; 8-9px labels raised
  to 10px and new sections given mobile rules.
- Docs: README carries the attribution table and pnpm commands; `RESUME_EVIDENCE.md` rewritten for V2 with the
  V1 bullets marked superseded; V1-only docs carry a scope note; AI assistance disclosed in README.

Verification (**verified**): 49 passed / 0 failed; build ok; overview, policy, and tribunal pages checked in a
dev server; no horizontal overflow at 375 px. Train/validation/final results unchanged.

**Attribution results (train seeds 1-600, exploratory):** hedging +$28.88 [$12.33, $46.89]; adaptive quoting
over hedged +$47.09 [$43.54, $50.83]; inventory skew alone −$0.07 [−$0.20, $0.06]; adaptive versus symmetric
hedged at ±$0.18 −$1.48 [−$4.62, $1.47].

## Blockers / not done

- Nothing pushed as of commit `680e9e1`. Hosted verification pending.
- `filtration.vercel.app` is an unrelated third-party site. The owner's Vercel projects (`filtration`,
  `project-tbd` under `shahwfabians-projects`) are behind Vercel Authentication, so the public production URL
  was not determined from this machine.
- Node 22 (CI version) not run locally; CI not triggered.

## Next specific task

Validate latency parameters (defect 4): require integer `quoteLatencySteps ≥ 0` and `hedgeLatencySteps ≥ 1`
in `validateResearchConfig` (or make zero-latency hedges execute), with a regression test. Then write a
preregistered ablation protocol for the attribution question using fresh seeds (e.g. 1001–1400), without
touching seeds 801–1000. The position-limit question (defect 3) needs the owner's decision first.
