# Fuzzy-match / dedupe engine

*Pure-function name matcher that keeps the dish vocabulary clean (snap/suggest/new) and flags duplicate places. Last updated 2026-05-31.*

## Status
Built. `src/lib/match.ts` is complete, pure (no I/O), and fully unit-tested (8 tests in `match.test.ts`). `resolveDishName` runs live as-you-type in the add flows and defensively server-side at insert. `MATCH.PLACE_DUP` (place dedupe) is the same engine applied with `similarity(...)` + a threshold; the place-side callers (curator review flag, seed-time merge) live outside this file — see Gotchas.

## Where it lives
| Path | Role |
| --- | --- |
| `src/lib/match.ts` | The whole engine: `normalizeName`, `distinctiveTokens`, `levenshtein`, `similarity`, `bestMatch`, `resolveDishName`. |
| `src/lib/config.ts` | `MATCH` constants — `SNAP 0.88`, `SUGGEST 0.6`, `PLACE_DUP 0.8`. |
| `src/lib/match.test.ts` | Unit tests pinning the thresholds + the category-strip behavior. |

## How it works

### 1. `normalizeName(s)` — the canonical comparison form
Lowercase, NFKD-decompose, strip combining accents (`̀-ͯ`), `& → " and "`, drop apostrophes (straight + curly, so contractions don't split: `joe's → joes`), replace any other non-`[a-z0-9]` run with a space, collapse whitespace. Null-safe (`s ?? ""`).
Examples (from tests): `"Crème Brûlée!" → "creme brulee"`, `"Mac & Cheese" → "mac and cheese"`, `"Joe's Pizza" → "joes pizza"`.

### 2. The category-word-stripping trick
Within a food type *every* dish shares the category word ("ramen", "pizza"), so it carries zero signal. `distinctiveTokens(s, stop)` normalizes, splits, then drops:
- tokens of length ≤ 1,
- `GENERIC_TOKENS` (`the a an of with and style classic original house special signature fresh homemade pie bowl plate sandwich`),
- any token from `stop` (the category name, itself normalized + split).

So `distinctiveTokens("Tonkotsu Ramen", ["ramen"]) → ["tonkotsu"]`. The distinctive part now drives the match.

### 3. `similarity(a, b, stop)` ∈ [0,1]
Blends token overlap with edit distance, both computed over distinctive tokens:
1. Exact-after-normalize shortcut → `1`.
2. Build distinctive-token sets `ta`, `tb`. If **either is empty** (e.g. both were just the category word), fall back to whole-string `editRatio` — guards against losing all signal.
3. `jaccard = inter/union`; `containment = inter / min(|ta|,|tb|)` (subset match: `"tonkotsu" ⊂ "tonkotsu ramen"`). `tokenScore = max(jaccard, 0.92·containment)` — the `0.92` lightly penalizes a pure-subset hit so it doesn't read as identical.
4. `editDistinctive = editRatio(sorted-tokens-a, sorted-tokens-b)` — Levenshtein over the joined+**sorted** distinctive tokens (order-independent), catching typos in the meaningful word (`"margarita" ≈ "margherita"`) without the category word diluting the ratio.
5. Return `max(tokenScore, editDistinctive)`.

`editRatio(a,b) = 1 − levenshtein(na,nb)/max(len)` over normalized strings. `levenshtein` is the classic two-row DP.

### 4. `bestMatch(input, candidates, nameOf, stop)`
Linear scan; returns the highest-`similarity` `MatchHit<T>` (`{ value, name, score }`) or `null` for an empty list. Generic over candidate type via `nameOf`.

### 5. `resolveDishName(input, existing, categoryName)` — the three decisions
Cleans input (trim + collapse spaces; empty → `new`), sets `stop = [categoryName]`, runs `bestMatch` against `existing` (identity `nameOf`), then thresholds the score:

```
score ≥ MATCH.SNAP (0.88)    → { decision: "snap",    name: hit.value (canonical), suggestion: hit.value }
score ≥ MATCH.SUGGEST (0.6)  → { decision: "suggest", name: cleaned (user input),  suggestion: hit.value }
otherwise                    → { decision: "new",     name: cleaned,               suggestion: null }
```

- **snap** auto-merges: the stored `name` is the *existing canonical spelling*, not the user's input (`"tonkotsu"` + `"Ramen"` → stores `"Tonkotsu Ramen"`).
- **suggest** keeps the user's input as `name` but surfaces `suggestion` for a "did you mean…?" — never forced (`"Margarita"` → suggests `"Margherita Pie"`, stores `"Margarita"`).
- **new** is a genuinely distinct dish.

Empty `existing` ⇒ always `new` (no hit).

## Key decisions & why
- **Strip the category word before comparing.** Without it every dish in a list shares a token and looks similar; with it the distinctive part decides (`Shoyu Ramen` vs `Tonkotsu Ramen` drops well below `SUGGEST` — pinned by a test). This is the core insight (`match.ts` header + OVERVIEW §5).
- **Blend token overlap *and* edit distance, take the max.** Token overlap nails reorderings/subsets; edit distance nails typos. Either path can carry a true match.
- **`containment` with a `0.92` haircut** so a substring (`"tonkotsu"`) snaps to its superset (`"tonkotsu ramen"`) but isn't treated as a perfect `1.0`.
- **suggest ≠ force.** Below the snap bar the engine *offers* but stores the user's text — avoids silently corrupting a genuinely new name that merely rhymes with an existing one.
- **Pure functions, no I/O.** Lets it run identically client-side (live) and server-side (defensive) and stay trivially unit-testable.
- **Not done:** no phonetic (Soundex/Metaphone), no per-category synonym dictionary, no Wikidata vocabulary backbone (deferred — OVERVIEW §11). `GENERIC_TOKENS`/`MATCH` thresholds are hand-tuned constants, not learned.

## Gotchas
- **`stop` words are normalized + split**, so multi-word categories work, but a category word that *is* the whole distinctive part will get stripped to nothing — then `similarity` falls back to whole-string `editRatio` (the `ta.size === 0 || tb.size === 0` branch). Intended, but it means a dish literally named the category compares as raw strings.
- **`GENERIC_TOKENS` includes `pie`, `bowl`, `plate`, `sandwich`** — these are silently dropped from *every* comparison regardless of category. A dish distinguished only by one of those words loses that signal.
- **Length-1 tokens are dropped** (`t.length > 1`), so single-letter distinctive tokens vanish.
- **Thresholds are global**, not per-category. `SNAP 0.88` is fairly aggressive; tune in `config.ts`, not at call sites.
- **`resolveDishName` returns the canonical `hit.value` only on snap** — callers must persist `result.name` (not the raw input) or the dedupe is lost.
- **Live hint can be ignored** — the same `resolveDishName` MUST also run at insert time server-side, or a client that skips the suggestion re-fragments the vocabulary. This defensive call is the safety net (OVERVIEW §5).
- **Place dedupe (`MATCH.PLACE_DUP 0.8`)** is the same `similarity` function, but the place-side callers (curator-review duplicate flag, seed-time name + ~250m proximity merge) are *not* in `match.ts` — find them in the place/seed code, not here.

## Related
- [OVERVIEW](../OVERVIEW.md) §5 (clean dish names + dedupe), §6 (add flows that consume it).
- [ranking-engine](./ranking-engine.md) — sibling pure-math module; both read tuning from `config.ts`.
- [data-layer](./data-layer.md) — where the defensive insert-time call and place dedupe actually fire.
