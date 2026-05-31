# Instagram share images

*Server-rendered 1080×1350 ranking posters (next/og) plus the client share sheet that pushes them to Instagram. Last updated 2026-05-31.*

## Status
Built (2026-05-31). The OG image route renders category + pinnacle posters with full empty/404 fallbacks; `ShareButton` ships native share + download + copy-link with a live-preview modal. No extra dependency — `next/og` ships with Next 15. Not yet exercised on the production Postgres adapter (route runs `getRepo()`, same factory the rest of the app uses, so it follows whatever adapter is active).

## Where it lives
| Path | Role |
| --- | --- |
| `src/app/share/[kind]/[id]/image/route.tsx` | The `ImageResponse` route handler. `GET` → PNG. Holds `poster()`, `rowEl()`, `notFoundPoster()`, `scoreColor()`, the palette/`MEDAL` constants. |
| `src/components/ShareButton.tsx` | `"use client"` trigger + share sheet (dialog). Native share, download, copy-link, live preview `<img>`. |
| Wired in `nyc/[sub]` (category) and `u/[handle]` (pinnacle) pages | Where `ShareButton` is mounted with the right `kind`/`id`/`title`/`pageHref`. |

## How it works

### The image route
`GET(_req, { params })` — `params` is a Promise (Next 15), so `const { kind, id } = await params`.

- `export const runtime = "nodejs"` — **required** because `getRepo()` touches the node-only fs/db layer; the OG default (edge) can't load it.
- `export const dynamic = "force-dynamic"` — data is live, never statically cached.
- Output is fixed `W = 1080` × `H = 1350` (Instagram 4:5 portrait). Returned as `new ImageResponse(tree, { width: W, height: H })`.

Two kinds, dispatched on the `kind` route segment:
- **`category`** — `repo.getRankedList(id)`; `null` → `404`. Rows = `list.ranked.slice(0, 10)`, mapping each to `{ rank: v.rank ?? i+1, dish: v.title, place: [v.placeName, v.neighborhood || v.borough].filter(Boolean).join(" · "), score: Math.round(v.score) }`. Header uses `list.subcategory.emoji`, peach band (`#fde7dc`→`#fbd9c6`), URL `faves.bandana.com/nyc/${id}`.
- **`pinnacle`** — `repo.getProfile(id)`; `null` → `404`. Rows = `profile.pinnacle.slice(0, 10)`, place built from `[p.placeName, p.subName]`. No emoji — a coral **monogram** circle from the first letter of `profile.name`; gold band (`#fdf0cf`→`#f8e3a6`); title `${firstName}'s Top ${rows.length}`; URL `faves.bandana.com/u/${id}`.
- Anything else → `404`.

Empty data (record exists but `rows.length === 0`) renders `notFoundPoster(...)` instead of the list ("Be the first to rank it." / "No favorites pinned yet.") — a graceful poster, not an error.

### Poster anatomy (`poster()`)
Column layout: gradient **header band** → flex-1 **list** → **footer**.
- Header: emoji (cat) or coral monogram (pinnacle), an uppercase letter-spaced **kicker**, the big **title** (auto-shrinks `84→64` when `title.length > 16`), and a **tagline**. Band is a `linear-gradient(135deg, bandFrom → bandTo)`.
- List spacing adapts to length: `rows.length >= 9` → `gap:0` + `justifyContent:"flex-start"`; otherwise `gap:4` + `space-between` so short lists fill the height.
- **`rowEl(r, isTop)`** — rank-1 row is emphasized (white card, border, larger). Each row: medal/numeral chip · dish+place column · score badge.
- Footer: coral "B" tile, "Bandana Faves / Ranked by duels, not stars", and the coral **URL CTA**.

### Color logic
- **Medal chips** (`MEDAL`): ranks 1/2/3 get gold/silver/bronze gradients via `backgroundImage`; rank ≥4 falls back to a flat `CREAM2` chip with `DIM` text.
- **`scoreColor(score)`**: `≥75` → `#009275` (bandana green); `≥60` → `#c79a2e` (darkened gold — raw gold is invisible on cream); else `DIM` `#7a7264`. Drives both badge border and text.

### The share sheet (`ShareButton`)
Props: `kind`, `id`, `title` (native-share text, e.g. "Best Pizza in NYC"), `pageHref` (the "see full ranking" link), optional `label`, `variant`. Derives `imgSrc = /share/${kind}/${id}/image` and `fileName = ${id}-bandana-faves.png`.

- **`nativeShare()`** — fetch the PNG → wrap in a `File`. If `nav.canShare({ files:[file] })`, call `nav.share({ files, title, text, url })` (file → Instagram/Messages). Else if `nav.share` exists, share link-only. Else download. In `catch`, `AbortError` (user dismissed) is swallowed; any other error falls back to download.
- **`download()`** — object-URL `<a download>` click, revoked after 1s.
- **`copyLink()`** — `navigator.clipboard.writeText(origin + pageHref)`; on failure shows the raw URL in `note`.
- **Modal** — `role="dialog"` `aria-modal`, opens on trigger. Effect locks `body.overflow`, closes on **Escape**, focuses the close button, and **restores focus to the trigger** on close. Backdrop click closes; inner click `stopPropagation`. Holds the live preview `<img src={imgSrc}>` in a `aspectRatio: "1080 / 1350"` box (reserves space so it doesn't jump; `onError` → `imgFailed` fallback text), the three action buttons, and a **"See the full ranking →"** link to `pageHref`.

## Key decisions & why
- **Render server-side with `next/og`/Satori, not html2canvas** — pixel-perfect, fast, no client canvas hacks, and it's already in Next 15 (zero new deps).
- **`runtime = "nodejs"` on an OG route** — deliberate. OG routes default to edge, but `getRepo()` is node-only; this is the load-bearing reason the route opts out of edge.
- **Share the FILE, not just a URL** — `canShare({ files })` is what lets the image land directly in Instagram/Messages; link-only and download are graceful degradations for browsers without file-share.
- **Empty ≠ missing** — a real-but-empty list still produces a branded "be the first" poster; only a missing record 404s.
- **Score gold is darkened to `#c79a2e`** — the site's raw gold is invisible on the cream poster background.
- **Not done:** no font embedding (uses `fontFamily:"sans-serif"`); no per-row photos; no caching layer (force-dynamic).

## Gotchas
Satori (the renderer behind `ImageResponse`) is **not** a browser — its constraints are real traps:
- **Flexbox only.** Every element is `display:flex`; no `block`/`grid`/`inline`. Any `<div>` with multiple children must set `display:flex` explicitly or it throws.
- **Inline hex only.** No CSS variables, no Tailwind classes, no named colors that rely on cascade — hence the local `INK`/`DIM`/`CORAL`/etc. constants.
- **NEVER set `backgroundImage:"none"`** — Satori crashes on it. The medal chip uses a spread (`...(MEDAL[r.rank] ? {backgroundImage} : {backgroundColor})`) so the property is simply absent for non-medal rows rather than set to `"none"`.
- **Truncation pattern** = `minWidth:0` on the flex parent **plus** `whiteSpace:"nowrap" + overflow:"hidden" + textOverflow:"ellipsis"` on the text node. Drop the `minWidth:0` and long dish/place names blow out the row width.
- **`params` is async** — must `await params` (Next 15).
- **Edge runtime would silently fail to import `getRepo`** — do not remove the `runtime = "nodejs"` line.
- `next/og` is dynamic-only here; don't expect a cached image to update after a duel without `force-dynamic`.

## Related
- [OVERVIEW](../OVERVIEW.md) — full product walkthrough (ranking math, 0–100 score, the pinnacle).
- [data-layer](./data-layer.md) — `getRepo()`, `getRankedList`, `getProfile` (the data this route reads, and where `score`/`rank` originate).
- [match-and-dedupe](./match-and-dedupe.md) — sibling subsystem deep-dive.
