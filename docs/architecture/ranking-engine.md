# Ranking engine

*Turns every signal (duel, 0–100 rating, trust) into one trust-weighted Bradley-Terry score per (food type × region) pool. Last updated 2026-05-31.*

## Status
Built. `rankSubcategory()` and `trustToWeight()` are pure, fully working, and unit-tested (`ranking.test.ts`, 6 tests). The math is live on the local seed and recomputed per food type after each duel/vote. What's *scaffolded around it*: the trust **moat** — `trustToWeight` works, but trust accrual/caps (NEW_USER_TRUST, NORMAL_CAP, EXPERT_CAP, GROWTH_PER_COMPARISON) are config constants whose enforcement is intentionally light (see OVERVIEW §3 "honesty about the trust moat"). The `RD_ESTABLISHED` rising/established split is a *display* tier derived from RD — the engine itself only emits `provisional` / `active` / `hidden` in `RankResult.status`.

## Where it lives
| File | Role |
| --- | --- |
| `src/lib/ranking.ts` | The entire ranking math. `rankSubcategory()`, `trustToWeight()`, types `RankInputDuel`/`RankInputVote`/`RankResult`. No I/O. |
| `src/lib/config.ts` | All tuning knobs: `RANKING` (score/BT/RD) and `TRUST` (weight mapping + caps). `ConfidenceTier` type. |
| `src/lib/ranking.test.ts` | `node:test` unit tests: order recovery, shrinkage knee, eligibility gate, vote direction, trust bounds, NaN safety. |
| `docs/OVERVIEW.md` §3 | Canonical prose walkthrough. |
| `scripts/recompute.ts` | Batch driver (calls the engine outside the request path). |

## How it works

`rankSubcategory(contenderIds, duels, votes) → Map<ID, RankResult>` ranks ONE pool. Everything below happens inside that one call.

### 1. Every signal → a weighted pairwise outcome
The model never tallies votes separately. There's a virtual anchor `BASELINE = "__baseline__"` fixed at strength γ=1.
- **Duel** (`RankInputDuel{winnerId, loserId, weight}`): `addComparison(winner, loser, weight)`. `weight` is the rater's trust weight at cast time. Also bumps `realEvidence`, `rawDuels`, and `opponents` (distinct-opponent set) for both sides.
- **0–100 rating** (`RankInputVote{contenderId, rating, weight}`): folded as a comparison vs `BASELINE`. `signed = (rating−50)/50 ∈ [−1,1]`; effective weight `w = |signed| · vote.weight · RANKING.THUMB_WEIGHT`. `signed>0` ⇒ contender beats baseline; `signed<0` ⇒ baseline beats contender. `rating==50` ⇒ `w==0`, skipped (no signal). Adds to `realEvidence` but NOT to `opponents` (a rating gives no distinct opponent).
- **Regularizing prior**: for every contender, a tiny *tie* vs baseline — `addComparison(id, BASELINE, 0.5·PRIOR_TIE_WEIGHT)` both directions. Keeps θ finite and pulls unsupported items toward the prior. Deliberately NOT counted in `realEvidence`.

`addComparison(winner, loser, w)` updates `wins[winner] += w` and the symmetric `pair` map (`pair[i][j]` = weighted comparison count between i,j); baseline accumulates nothing for itself (it's pinned).

### 2. Weighted Bradley-Terry via MM
Each contender has latent strength γ (θ = log γ). Solved with the standard Hunter-2004 MM (minorize-maximize) update, run `RANKING.BT_ITERATIONS` (40) times — no normalization needed because baseline is fixed at 1:

```
γ_i ← W_i / Σ_j ( n_ij / (γ_i + γ_j) )    # γ_baseline ≡ 1
```

where `W_i = wins[i]`, `n_ij = pair[i][j]`. Result clamped to `[GAMMA_MIN, GAMMA_MAX]` = `[1e-3, 1e3]`; if `denom==0`, γ is left unchanged. The PRIOR_TIE term gives every contender a nonzero denom against baseline, so an all-win / all-loss item can't blow γ to 0/∞.

### 3. θ → harsh 0–100 score (z-normalized within category)
`θ = log γ`. Compute the pool's `meanTheta` and `stdTheta` (`stdTheta || 1` guards a degenerate single-item pool). Then per contender:
```
z        = (θ − meanTheta) / stdTheta
scoreRaw = 100 / (1 + e^(−HARSHNESS·z))          # HARSHNESS = 2.2
```
z-normalizing makes the curve shape consistent no matter how compressed the BT strengths are: the *average* spot ≈ 50, elites approach ~100, weak spots sink. HARSHNESS 2.2 is punishing — only clear greats clear the 80s.

### 4. Bayesian shrinkage (volume gate on the score)
```
v     = realEvidence[i]                            # weighted evidence, excludes the prior tie
score = (v/(v+m))·scoreRaw + (m/(v+m))·CATEGORY_PRIOR_C   # m = SHRINKAGE_M, C = 50
```
A thin contender is pinned near 50 (`CATEGORY_PRIOR_C`); it only earns its full `scoreRaw` as `v` grows. `m = SHRINKAGE_M` (6) is the knee. NOTE: the code shrinks toward the fixed constant `CATEGORY_PRIOR_C = 50`, not the live category mean (OVERVIEW §3 wording "toward the category mean" is loose — the source uses the 50 constant). `score` is rounded to 1 decimal in the result.

### 5. Glicko-style RD + eligibility
```
rd = RANKING.RD_BASE / sqrt(1 + v / RANKING.RD_Q)   # 350 / sqrt(1 + v/40)
```
More evidence ⇒ lower RD ⇒ more confident. `RD_ESTABLISHED` (110) is the display threshold: past the gate, RD<110 ⇒ "established", else "rising" (a `ConfidenceTier`, applied by the UI, not set here).

Eligibility (enters the visible ranked list):
```
eligible = v ≥ MIN_WEIGHTED_VOTES (3) AND distinctOpponents ≥ MIN_DISTINCT_OPPONENTS (2)
```
`distinctOpponents` counts only real *contender* opponents from duels — ratings don't help you clear the gate. `status = eligible ? "active" : "provisional"`. (`"hidden"` is in the union but not assigned by this function.)

### 6. LCB sort + rank assignment
```
sortKey = score − LCB_LAMBDA · (rd / RD_BASE) · 100     # LCB_LAMBDA = 0.8
```
A lower-confidence bound: a proven-good dish outranks an uncertain maybe-great one. Only `active` contenders are sorted (descending `sortKey`) and assigned `rank = i+1`; provisional items keep `rank = null`.

### Trust → weight
```ts
trustToWeight(t) = W_MIN + (W_MAX − W_MIN) · clamp(t,0,1)^GAMMA   // 0.2 + 2.8·t^1.5
```
Convex in trust (`GAMMA = 1.5`): new users near `W_MIN` 0.2, max trust → `W_MAX` 3.0. This weight is what callers pass as each duel/vote `weight`. Per-category caps (`NORMAL_CAP` 0.7 → weight ≈ 1.84; `EXPERT_CAP` 1.0 → full 3.0) are applied upstream when deriving `t`, not inside the engine.

### Recompute model
Recomputed **per food type right after a duel/vote** — the whole pool is re-solved from scratch (no incremental update). Cheap at this scale; correctness over speed.

## Key decisions & why
- **One model, no separate vote tally.** Ratings become baseline-anchored comparisons so they're order-independent and can't be gamed as a raw count (OVERVIEW §2/§3). `THUMB_WEIGHT = 0.4` makes a rating weaker evidence than an explicit duel.
- **Fixed baseline anchor + PRIOR_TIE.** Pins the γ scale (no post-hoc normalization) and regularizes sparse/extreme items so MM can't diverge. The tie is excluded from `realEvidence` so it never inflates confidence or score volume.
- **z-normalize before the logistic.** Decouples the displayed harshness from however compressed/spread the raw BT strengths happen to be in a given category.
- **Shrink toward 50, not toward the mean.** Thin items sit at neutral until earned — honesty over flattering early numbers.
- **Show confidence, don't hide it.** RD + provisional gate + LCB sort are all about *honest* order, the product's stated identity.
- **Deliberately NOT done:** incremental/online updates (full recompute instead), MM convergence early-exit (fixed 40 iters), the trust-accrual ledger (constants exist, enforcement light), and any `"hidden"` status logic in the engine.

## Gotchas
- **`votes` don't satisfy `MIN_DISTINCT_OPPONENTS`.** A contender with only ratings (any number) has 0 distinct opponents → stays `provisional` forever. Needs real duels to rank (see the "Lonely" test).
- **`rating == 50` is a no-op** (`w==0`, skipped) — neutral genuinely contributes nothing, not a tie.
- **`realEvidence` excludes the prior tie** but includes the *effective* (THUMB_WEIGHT-scaled) rating weight — so the `v` driving shrinkage and RD is weighted, not a raw count. "200 ratings" in comments means ~weighted-200.
- **`SHRINKAGE_M` is env-overridable** (`RANKING_SHRINKAGE_M`); default 6. Its doc-comment mentions m=40 as an example — the live default is 6. The single most impactful knob.
- **`MIN_WEIGHTED_VOTES = 3` is intentionally low** for the placeholder seed so lists aren't empty; raise it once real volume exists.
- **γ clamp `[1e-3, 1e3]`** caps θ at roughly ±6.9 — extreme dominators/losers are bounded, which also bounds z indirectly.
- **Single-contender / no-signal pools are safe** (`stdTheta || 1`, denom guard) — `theta/score/rd` stay finite, score ∈ [0,100] (NaN-safety test).
- **Tuning constants** at a glance: `SHRINKAGE_M` (volume knee), `CATEGORY_PRIOR_C` (50, shrink target), `HARSHNESS` (2.2, curve steepness), `THUMB_WEIGHT` (0.4, rating vs duel), `PRIOR_TIE_WEIGHT` (0.5, regularizer), `BT_ITERATIONS` (40), `RD_BASE` (350) / `RD_Q` (40) / `RD_ESTABLISHED` (110), `LCB_LAMBDA` (0.8), `MIN_WEIGHTED_VOTES` (3) / `MIN_DISTINCT_OPPONENTS` (2); trust: `W_MIN` (0.2) / `W_MAX` (3) / `GAMMA` (1.5), `NEW_USER_TRUST` (0.1), `NORMAL_CAP` (0.7) / `EXPERT_CAP` (1.0), `GROWTH_PER_COMPARISON` (0.01).

## Related
- [OVERVIEW](../OVERVIEW.md) §3 — canonical ranking walkthrough.
- [data-layer](./data-layer.md) — where contenders/duels/votes are stored and how the engine is invoked on write.
- `src/lib/match.ts` (fuzzy dedupe) shares `config.ts` (the `MATCH.*` thresholds) — see OVERVIEW §5.
