# Overnight build — comparison-only ranking + the single-voter fix

**Branch:** `ranking-comparison-only` (NOT pushed — review then ship). **Status:** `tsc` clean, 20/20 unit
tests pass. Built in response to two asks:

1. *"A few items in the flow still ask us to rate 0–100 — ranking should all be based on comparison."*
2. *"I added a fig pizza, dueled it a ton, and now it's #1 — being the only user shouldn't put it on top."*

---

## What was actually happening (root cause)

Pulled the live data to confirm. Your **"Fig Jam and Bacon Slice"** at #1 is **user-created**
(`seed_score = 0`, no publication backing), with **11 duels but only 1 distinct dueler — you** — and
**0 of the 0–100 ratings**. So it didn't even need the slider; the old engine let a single person's
duels drive a brand-new dish to a clean **100** because:

- Class activation keyed off **volume, not distinct voters** — one curator dueling 11 times fully
  "activated" the power class, the blend collapsed to that one class, and the harsh logistic maps the
  top item to ~100.
- There was **no distinct-voter gate** — one person could put anything on the board.
- (And the 0–100 standing rating was a second, separate way to inflate a score directly.)

---

## The fix — two mechanisms (both in `src/lib/ranking.ts`)

### 1. Comparison-only
The 0–100 standing rating (`Vote`) is **removed from the whole flow**. Ranking evidence is now **only
head-to-head duels**.

### 2. A dish ranks only with real corroboration — else it reads "Unranked"
- **Corroboration gate** (`SOURCE.MIN_VOTERS = { user: 5, power: 2 }`): an item earns a **numeric
  score + a rank** only when it is **publication-backed**, OR has **≥5 distinct voters**, OR **≥2
  distinct power users** of that category (a user counts once per category, so the user/power sets are
  disjoint). Editorial items bypass the gate (editorial consensus *is* the corroboration).
- **Below the bar it shows "Unranked"** — no number, no 0. In the engine the item is `standing: "new"`;
  `ScoreBadge` renders a dashed "Unranked" pill instead of a score. (So the ~446 menu-imported pizzas
  that used to read "0" now read "Unranked" until people rank them.)
- Ranked items sort by the **displayed score** (your earlier ask); RD breaks ties (more-confident wins).

**Net effect on your fig pizza:** `seed_score 0`, 1 dueler → **Unranked**, off the board. It earns a
rank once 2 power users (or 5 people) duel it.

---

## Files changed

| File | Change |
|---|---|
| `src/lib/ranking.ts` | Comparison-only (removed `RankInputVote` + vote folding); added `by` (voter id) to duels; distinct voter tracking by class; **corroboration gate** (pub / ≥5 users / ≥2 power) → below it `standing: "new"`; sort by score. |
| `src/lib/config.ts` | `SOURCE.MIN_VOTERS = { user: 5, power: 2 }`; removed unused `RANKING.THUMB_WEIGHT`. |
| `src/components/bits.tsx` | `ScoreBadge` renders an **"Unranked"** pill when `standing === "new"`; threaded `standing` through the ~14 call sites. |
| `src/db/repo.ts`, `src/db/memory.ts`, `src/app/feed/page.tsx` | **Feed "Worth a try"** shelf — `getTryThese()` surfaces rising-but-unranked dishes ("On the rise") + editorial picks ("Editors' pick") the user hasn't tried. |
| `src/seed/placeholder.ts` | Recompute passes duels with `by`, no votes; seed no longer synthesizes 0–100 ratings (duels only). |
| `src/db/pg.ts` | **Boot now always recomputes** every category, so this ranking change activates on deploy (delta-flush no-ops if nothing changed). |
| `src/db/memory.ts` | Personal ("Mine") ranking is duel-only (dropped the vote branch); feed no longer emits "rating" items. |
| `src/app/c/[id]/page.tsx` | Removed the `RatingControl` slider. |
| `src/components/RatingControl.tsx`, `VoteButtons.tsx`, `src/app/api/vote/route.ts` | **Deleted** (RatingControl = the 0–100 slider; VoteButtons was already dead code posting to the same route; `/api/vote` is gone). |
| `src/lib/ranking.test.ts` | Rewritten for comparison-only; new tests assert single-voter ⇒ unranked + shrunk, 2nd voter ⇒ board-eligible, editorial preserved. |
| copy in `feed` / `admin/import` | "duels & ratings" → "duels". |

`repo.recordVote` / the `Vote` type / the `votes` table are left in place but **inert** (nothing writes
or reads them for ranking) — see follow-ups.

---

## Behavior you should know

- **During the solo phase (basically just you):** no user-created dish gets a rank until it's
  corroborated (you're a curator → power user, so it takes **2 power users**, i.e. one more curator;
  or 5 normal voters). Until then it reads **"Unranked."** The ranked board stays the editorial set.
- Editorial scores may shift **slightly** (the synthetic 0–100 votes no longer nudge the blend), but
  their order is preserved (seedScore + duels). The big visible change: user-created items without
  corroboration now read "Unranked" instead of a number, and drop off the board.
- Tune in `config.ts`: `SOURCE.MIN_VOTERS.user` / `.power` are the bars. Lower them to rank user dishes
  sooner during early growth; raise them to demand more corroboration.

## Verify

```bash
npx tsc --noEmit && npm test         # 20/20, incl. the fig-pizza guards
```

Live check already done (read-only): the #1 fig pizza = 1 distinct dueler, seed_score 0 → will go
unranked on the recompute.

## How to ship

1. Review the diff (`git diff main...ranking-comparison-only`).
2. Merge to `main` and deploy (your call — needs your "git approved"; I did **not** push).
3. On deploy, `initPgStore` recomputes all categories → fig pizza drops off the pizza board and the
   scores reflect the comparison-only + confidence logic. No manual step.

**Rollback:** revert the merge and redeploy — the boot recompute will re-rank with the old engine.

## Optional follow-ups (not done)

- Purge the legacy `votes` rows from prod (cosmetic; they're already ignored). Easy `DELETE FROM votes`.
- Fully remove `recordVote` + the `votes` table/`Vote` type once you're sure nothing external depends on them.
- Reconsider `MIN_VOTERS` if you want a softer gate during early growth (e.g., let a high-trust curator's
  single vote count as provisional-ranked) — currently intentionally strict per your note.
