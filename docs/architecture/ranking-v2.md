# Ranking v2 — source-weighted, start-at-zero, top-100, risers

*The redesigned ranking model (2026-05-31). Supersedes the single-pool Bradley-Terry score in
[ranking-engine](./ranking-engine.md) for how the public score is composed. Last updated 2026-05-31.*

## Why
Founder direction: (1) a new item should start **unranked at 0**, not 50; (2) only the **top 100**
per category are "ranked", everything else is **unranked** until it climbs in; (3) the score is a
**weighted blend of source classes** — *publications 50% · users 25% · power users 25%*; (4) surface
the **fastest risers** even when unranked.

## The three source classes
Every piece of evidence belongs to a class, derived from the rater at recompute time (no schema
change on comparisons/votes — the class is computed, not stored):
- **publication** — the editorial seed. Each contender carries `seedScore` (0–100, from the 2025+
  best-of consensus) and `seedSources` (the publications). Publication volume = Σ of each source's
  weight from the `PUBLICATIONS` registry (MICHELIN 1.0, Infatuation 0.9, Eater/NYT 0.8, Time Out
  0.7, default 0.5).
- **power** — a curator, or a user whose category trust ≥ `POWER_USER_TRUST` (0.8).
- **user** — everyone else.

## How the blend works (per contender, per category)
1. **Per-class quality** — run the existing BT + harsh-logistic + category-z pipeline **separately**
   over the `user` evidence and the `power` evidence → `userScore`, `powerScore` ∈ [0,100]. The
   `publication` quality is `seedScore` directly.
2. **Per-class volume** — `userVol`/`powerVol` = weighted real evidence in that class; `pubVol` =
   Σ publication weights.
3. **Activation** — a class only earns its share once it has volume: `a_c = vol_c / (vol_c + M_c)`.
4. **Effective weight** — `w_c = TARGET_c · a_c`, with `TARGET = {pub:0.50, user:0.25, power:0.25}`.
5. **Blended score** — `Σ(w_c · score_c) / Σ w_c`, renormalized over whichever classes are active.
   So at launch (publications only) a seeded list shows its editorial order; as users and power
   users weigh in, their 25% shares blend in.
6. **Zero state** — if `Σ w_c == 0` (no evidence at all) → **score 0, standing `new`**.

## Standing (where it sits) vs tier (how settled)
Two orthogonal dimensions:
- **standing**: `ranked` (eligible & within the top `RANKED_CAP` = 100) · `unranked` (eligible but
  below the cap, or below the evidence gate yet has some signal) · `new` (zero evidence, score 0).
- **tier** (unchanged, confidence): `provisional` / `rising` / `established` from RD.

**Eligibility gate** (to leave `new`): `pubVol > 0` OR real evidence ≥ `MIN_EVIDENCE`. Seeded items
clear it via publications; user-added items climb in once dueled/rated.

`status` (persisted) stays `active` (=ranked) / `provisional` (=unranked or new) / `hidden` /
`proposed` so the rest of the app is unchanged; the finer `standing` drives the new UI sections.

## Risers
`riserScore` = weighted evidence in the last `RISER_WINDOW_DAYS` (14). The category page shows an
**Up & coming** shelf of the highest-velocity contenders (especially unranked ones) — momentum even
before they crack the top 100. Empty on a fresh seed (one timestamp); fills as real usage flows.

## Personal lists are unaffected
`getPersonalRankedList` still ranks from the user's own votes/duels regardless of global standing —
your own list ranks everything you've tried, even items that are globally `new`.

## Where it lives
- `src/lib/config.ts` — `SOURCE` (targets, M, power threshold, cap, gate, riser window) + `PUBLICATIONS`.
- `src/lib/ranking.ts` — `rankSubcategory` now takes per-contender seed signal + per-evidence class
  + timestamps; returns `standing` + `riserScore`.
- `src/lib/types.ts` — `Contender.seedScore/standing/riserScore`; `ContenderView.standing/riserScore`.
- `src/seed/placeholder.ts` — sets `seedScore` from seed quality; classifies seeded raters.
- `src/db/memory.ts` — classifies raters into user/power at recompute; new ranked/unranked/risers views.
- `src/db/pg.ts` — `contenders` gains `seed_score`, `standing`, `riser_score` (ALTER ADD COLUMN IF NOT EXISTS).

## Related
- [ranking-engine](./ranking-engine.md) (the underlying BT math, still used per class)
- [domain-model](./domain-model.md) · [data-layer](./data-layer.md) · [OVERVIEW](../OVERVIEW.md) §3
