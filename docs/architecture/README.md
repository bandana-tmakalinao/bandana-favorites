# Architecture docs

One `.md` per major subsystem of **Bandana Faves** — the deep-dives that sit under the
project-wide [OVERVIEW](../OVERVIEW.md). Each doc follows the same shape: *Status · Where it lives ·
How it works · Key decisions & why · Gotchas · Related*. Start with OVERVIEW for the vision and the
big picture; come here for how a specific part actually works.

## The map

| Doc | What it covers |
| --- | --- |
| [domain-model](./domain-model.md) | Core entities + UI view models — the canonical "what are the types" reference. The atomic unit = `contender = (place × food type)`. |
| [data-layer](./data-layer.md) | The `Repository` seam, in-memory default vs. Postgres/PostGIS, the durable working-set + debounced write-through, boot/seed. |
| [ranking-engine](./ranking-engine.md) | Trust-weighted Bradley-Terry → harsh 0–100 score, shrinkage, RD/confidence tiers, the LCB sort. |
| [match-and-dedupe](./match-and-dedupe.md) | Fuzzy dish-name resolution (snap/suggest/new) + place dedupe; the category-word-stripping trick. |
| [auth-and-trust](./auth-and-trust.md) | The three sign-in paths, per-category trust → vote weight, and the honest Sybil-defense story. |
| [add-and-curation](./add-and-curation.md) | Restaurant-first + category-first add flows, structural dedupe, the curator review queue. |
| [showcase-ui](./showcase-ui.md) | How rankings are presented: `/`, `/explore`, the hub, `RankingCard`, `RotatingCover`, the cream/coral design system + mobile no-overflow contract. |
| [share-images](./share-images.md) | The `next/og` Instagram poster generator + `ShareButton` (built 2026-05-31). |
| [pages-and-flows](./pages-and-flows.md) | The app map: every page route, the core loop, and the API endpoint table. |
| [deployment-and-ops](./deployment-and-ops.md) | Local-first config, the env-gated production adapters, npm scripts, Render/GitHub, operating constraints. |

## Conventions
- Docs describe **what's on disk today**; when something is scaffolded-but-not-wired they say so.
- They cross-link with relative paths and point back to [OVERVIEW](../OVERVIEW.md) and
  [../../DECISIONS.md](../../DECISIONS.md) (the build log) for the rest.
- Keep them in sync when a subsystem changes — they're reference, not history.

*See also: [README](../../README.md) (quick start), [DECISIONS](../../DECISIONS.md) (build log),
[data-sourcing-research](../data-sourcing-research.md) (legal sourcing verdicts).*
