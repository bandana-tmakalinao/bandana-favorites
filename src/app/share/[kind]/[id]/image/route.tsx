import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getRepo } from "@/db/repo";
import { shareGradient, SHARE_CORAL, SHARE_GREEN } from "@/lib/shareTheme";

// getRepo() touches the node-only fs/db layer, so this OG route runs on the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const W = 1080;
const H = 1350;
const N = 5; // Top 5 — Spotify-Wrapped-style: few items, huge type, lots of impact.

// Brand palette (hex only — Satori has no CSS vars).
const INK = "#231c16";
const DIM = "#7a7264";
const CREAM = "#fff8f1";
const GOLD = "#efb745";

// Gradient backdrops (the "story" color field — bold + saturated, Wrapped energy). Category posters
// use a per-category gradient (src/lib/shareTheme.ts); coral/green are the fallbacks + pinnacle field.
const CORAL_BG = SHARE_CORAL;
const GREEN_BG = SHARE_GREEN;

// Rank-medal fills (gold / silver / bronze) for the top 3; plain numeral below.
const MEDAL: Record<number, string> = {
  1: "linear-gradient(135deg,#f6d36b,#e0a93c)",
  2: "linear-gradient(135deg,#e6e3da,#b8b1a1)",
  3: "linear-gradient(135deg,#e6b98a,#c2895a)",
};

function scoreColor(score: number): string {
  if (score >= 75) return "#009275"; // bandana green
  if (score >= 60) return "#c79a2e"; // darkened gold (raw gold is invisible on white)
  return "#8a8276";
}

// --- assets: embed the logo + real display fonts (cached after first read) -------------------
function tryRead(...p: string[]): Buffer | null {
  try {
    return readFileSync(join(process.cwd(), ...p));
  } catch {
    return null;
  }
}
let LOGO: string | null | undefined;
function logo(): string | null {
  if (LOGO === undefined) {
    const buf = tryRead("public", "logo-share.png");
    LOGO = buf ? `data:image/png;base64,${buf.toString("base64")}` : null;
  }
  return LOGO;
}
/** Archivo Black (display) + Inter (body). If a file is missing, return [] → Satori uses its default. */
let FONTS: { name: string; data: Buffer; weight: 400 | 600 | 700 | 800; style: "normal" }[] | undefined;
function fonts() {
  if (FONTS === undefined) {
    const f = (file: string) => tryRead("public", "fonts", file);
    const archivo = f("ArchivoBlack-400.woff");
    const i4 = f("Inter-400.woff");
    const i6 = f("Inter-600.woff");
    const i7 = f("Inter-700.woff");
    const i8 = f("Inter-800.woff");
    FONTS =
      archivo && i4 && i6 && i7 && i8
        ? [
            { name: "Archivo Black", data: archivo, weight: 400 as const, style: "normal" as const },
            { name: "Inter", data: i4, weight: 400 as const, style: "normal" as const },
            { name: "Inter", data: i6, weight: 600 as const, style: "normal" as const },
            { name: "Inter", data: i7, weight: 700 as const, style: "normal" as const },
            { name: "Inter", data: i8, weight: 800 as const, style: "normal" as const },
          ]
        : [];
  }
  return FONTS;
}
const DISPLAY = "Archivo Black";
const BODY = "Inter";

type Row = { rank: number; dish: string; place: string; score?: number; highlight?: boolean };

function rowEl(r: Row) {
  const sc = scoreColor(r.score ?? 0);
  const medal = MEDAL[r.rank];
  return (
    <div
      key={r.rank}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 26,
        width: 944,
        height: 126,
        padding: "0 26px",
        borderRadius: 30,
        backgroundColor: "#ffffff",
        boxShadow: r.highlight ? `0 0 0 8px ${GOLD}, 0 10px 26px rgba(60,20,0,0.16)` : "0 10px 26px rgba(60,20,0,0.16)",
      }}
    >
      {/* rank — gradient coin for 1-3, big numeral otherwise */}
      <div
        style={{
          display: "flex",
          width: 84,
          height: 84,
          borderRadius: 42,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontFamily: DISPLAY,
          fontSize: 42,
          color: medal ? "#3a2a12" : "#bdb4a6",
          ...(medal ? { backgroundImage: medal } : { backgroundColor: "#f3efe7" }),
        }}
      >
        {r.rank}
      </div>

      {/* dish + place */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            fontFamily: DISPLAY,
            fontSize: 44,
            color: INK,
            lineHeight: 1.05,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {r.dish}
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: BODY,
            fontSize: 27,
            fontWeight: 500,
            color: DIM,
            marginTop: 8,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {r.place}
        </div>
      </div>

      {/* score (omitted for an unranked dish so a personal list never shows an ugly 0) */}
      {r.score != null && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 110 }}>
          <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 58, color: sc, lineHeight: 1 }}>
            {r.score}
          </div>
          <div style={{ display: "flex", fontFamily: BODY, fontSize: 18, fontWeight: 700, letterSpacing: 2, color: "#b7af9f" }}>
            / 100
          </div>
        </div>
      )}
    </div>
  );
}

function poster(opts: {
  bg: string;
  glyph: { emoji: string } | { monogram: string };
  kicker: string;
  title: string;
  tagline: string;
  url: string;
  rows: Row[];
  /** Dish titles can be long — wrap (smaller) instead of the category-name nowrap-ellipsis. */
  wrapTitle?: boolean;
}) {
  const tlen = opts.title.length;
  const titleSize = opts.wrapTitle
    ? tlen > 26
      ? 64
      : 78
    : tlen > 18
      ? 88
      : tlen > 12
        ? 110
        : 132;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: W,
        height: H,
        backgroundColor: "#ed7f54",
        backgroundImage: opts.bg,
        fontFamily: BODY,
      }}
    >
      {/* decorative soft circles — Wrapped-style graphic depth */}
      <div style={{ display: "flex", position: "absolute", top: -160, right: -120, width: 460, height: 460, borderRadius: 230, backgroundColor: "rgba(255,255,255,0.10)" }} />
      <div style={{ display: "flex", position: "absolute", bottom: 120, left: -150, width: 380, height: 380, borderRadius: 190, backgroundColor: "rgba(255,255,255,0.07)" }} />

      {/* header */}
      <div style={{ display: "flex", flexDirection: "column", padding: "56px 68px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 20px",
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.22)",
            }}
          >
            {logoTile(40)}
            <span style={{ fontFamily: BODY, fontSize: 24, fontWeight: 800, letterSpacing: 1, color: "#ffffff" }}>
              BANDANA FAVES
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginTop: 24 }}>
          {"emoji" in opts.glyph ? (
            <div style={{ display: "flex", fontSize: 110, lineHeight: 1 }}>{opts.glyph.emoji}</div>
          ) : (
            <div
              style={{
                display: "flex",
                width: 128,
                height: 128,
                borderRadius: 64,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#ffffff",
                fontFamily: DISPLAY,
                fontSize: 62,
                color: INK,
                flexShrink: 0,
              }}
            >
              {opts.glyph.monogram}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            fontFamily: BODY,
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: 8,
            color: "rgba(255,255,255,0.85)",
            marginTop: 26,
          }}
        >
          {opts.kicker}
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: DISPLAY,
            fontSize: titleSize,
            color: "#ffffff",
            lineHeight: opts.wrapTitle ? 1.02 : 0.98,
            marginTop: 4,
            whiteSpace: opts.wrapTitle ? "normal" : "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: W - 136,
          }}
        >
          {opts.title}
        </div>
        <div style={{ display: "flex", fontFamily: BODY, fontSize: 28, fontWeight: 500, color: "rgba(255,255,255,0.82)", marginTop: 18 }}>
          {opts.tagline}
        </div>
      </div>

      {/* the 5 cards */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
        {opts.rows.map(rowEl)}
      </div>

      {/* footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 68px 60px",
        }}
      >
        <div style={{ display: "flex", fontFamily: BODY, fontSize: 27, fontWeight: 800, color: "#ffffff" }}>
          {opts.url}
        </div>
        <div style={{ display: "flex", fontFamily: BODY, fontSize: 24, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>
          ranked by duels, not stars
        </div>
      </div>
    </div>
  );
}

function logoTile(size: number) {
  const l = logo();
  if (l) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={l} width={size} height={size} style={{ borderRadius: 9 }} alt="" />;
  }
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: 9,
        backgroundColor: GOLD,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: DISPLAY,
        fontSize: size * 0.55,
        color: INK,
      }}
    >
      B
    </div>
  );
}

function notFoundPoster(title: string, message: string) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: W,
        height: H,
        backgroundColor: "#ed7f54",
        backgroundImage: CORAL_BG,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: BODY,
        padding: 80,
      }}
    >
      <div style={{ display: "flex", fontSize: 130 }}>🍴</div>
      <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 64, color: "#ffffff", marginTop: 28, textAlign: "center" }}>
        {title}
      </div>
      <div style={{ display: "flex", fontSize: 32, color: "rgba(255,255,255,0.85)", marginTop: 14 }}>{message}</div>
      <div style={{ display: "flex", fontFamily: BODY, fontSize: 28, fontWeight: 800, color: "#ffffff", marginTop: 50 }}>
        faves.bandana.com
      </div>
    </div>
  );
}

function respond(tree: React.ReactElement) {
  return new ImageResponse(tree, {
    width: W,
    height: H,
    fonts: fonts(),
    // Never let a stale (old Top-10) image linger in a browser/IG cache.
    headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" },
  });
}

// --- landscape OG variant (1200×630) — what iMessage/Slack/X unfurl when a link is pasted -------
const OG_W = 1200;
const OG_H = 630;

function respondOg(tree: React.ReactElement) {
  return new ImageResponse(tree, {
    width: OG_W,
    height: OG_H,
    fonts: fonts(),
    headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" },
  });
}

/** Landscape unfurl card: text block left, up to 3 podium rows (or a big emoji) right. */
function ogPoster(opts: {
  bg: string;
  emoji: string;
  kicker: string;
  title: string;
  tagline: string;
  url: string;
  rows: Row[];
}) {
  const tlen = opts.title.length;
  const titleSize = tlen > 22 ? 56 : tlen > 14 ? 68 : 84;
  return (
    <div
      style={{
        display: "flex",
        width: OG_W,
        height: OG_H,
        backgroundColor: "#ed7f54",
        backgroundImage: opts.bg,
        fontFamily: BODY,
      }}
    >
      <div style={{ display: "flex", position: "absolute", top: -140, right: -100, width: 380, height: 380, borderRadius: 190, backgroundColor: "rgba(255,255,255,0.10)" }} />
      <div style={{ display: "flex", position: "absolute", bottom: -120, left: -90, width: 320, height: 320, borderRadius: 160, backgroundColor: "rgba(255,255,255,0.07)" }} />

      {/* left: the words */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "48px 20px 44px 56px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 18px",
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.22)",
            alignSelf: "flex-start",
          }}
        >
          {logoTile(34)}
          <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: 1, color: "#ffffff" }}>BANDANA FAVES</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "rgba(255,255,255,0.85)" }}>
            {opts.kicker}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: DISPLAY,
              fontSize: titleSize,
              color: "#ffffff",
              lineHeight: 1.02,
              marginTop: 6,
              maxWidth: 640,
            }}
          >
            {opts.title}
          </div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 500, color: "rgba(255,255,255,0.85)", marginTop: 14, maxWidth: 600 }}>
            {opts.tagline}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 23, fontWeight: 800, color: "#ffffff" }}>{opts.url}</div>
      </div>

      {/* right: the proof — podium rows, or a giant emoji when there are none */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 14, width: 470, padding: "32px 40px 32px 0" }}>
        {opts.rows.length > 0 ? (
          opts.rows.slice(0, 3).map((r) => {
            const medal = MEDAL[r.rank];
            return (
              <div
                key={r.rank}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  width: 430,
                  height: 92,
                  padding: "0 20px",
                  borderRadius: 24,
                  backgroundColor: "#ffffff",
                  boxShadow: r.highlight ? `0 0 0 6px ${GOLD}, 0 8px 20px rgba(60,20,0,0.18)` : "0 8px 20px rgba(60,20,0,0.18)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontFamily: DISPLAY,
                    fontSize: 28,
                    color: medal ? "#3a2a12" : "#bdb4a6",
                    ...(medal ? { backgroundImage: medal } : { backgroundColor: "#f3efe7" }),
                  }}
                >
                  {r.rank}
                </div>
                <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 26, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.dish}
                  </div>
                  <div style={{ display: "flex", fontSize: 17, fontWeight: 500, color: DIM, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.place}
                  </div>
                </div>
                {r.score != null && (
                  <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 34, color: scoreColor(r.score), flexShrink: 0 }}>
                    {r.score}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div style={{ display: "flex", fontSize: 200, lineHeight: 1 }}>{opts.emoji}</div>
        )}
      </div>
    </div>
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const repo = getRepo();
  const url = new URL(_req.url);
  // ?og=1 → 1200×630 landscape for link unfurls (iMessage/Slack/X); default stays the
  // 1080×1350 Instagram portrait.
  const og = url.searchParams.get("og") === "1";

  // Site-wide unfurl — the brand card behind the home page + any page without its own poster.
  if (kind === "site") {
    const showcase = repo.getHomeShowcase(3);
    const rows: Row[] = showcase
      .filter((e) => e.items.length > 0)
      .slice(0, 3)
      .map((e, i) => ({
        rank: i + 1,
        dish: e.items[0].title,
        place: `#1 ${e.name} · ${e.items[0].placeName ?? ""}`,
        score: Math.round(e.items[0].score),
      }));
    return respondOg(
      ogPoster({
        bg: SHARE_CORAL,
        emoji: "🍕",
        kicker: "NEW YORK CITY",
        title: "The best food in NYC, ranked by the food.",
        tagline: "Head-to-head duels and earned trust — never star averages.",
        url: "faves.bandana.com",
        rows,
      }),
    );
  }

  // Single-dish poster — "this specific pastrami is #2 in NYC". id = contender id.
  if (kind === "dish") {
    const detail = repo.getContenderDetail(id);
    if (!detail) return new Response("Not found", { status: 404 });
    const { contender: c, subcategory, place } = detail;
    const list = repo.getRankedList(subcategory.slug);
    const ranked = list?.ranked ?? [];
    const total = ranked.length;
    const kicker = c.rank
      ? `#${c.rank} OF ${total} · BEST ${subcategory.name.toUpperCase()} IN NYC`
      : `BEST ${subcategory.name.toUpperCase()} IN NYC`;
    const tagline = [place.name, place.neighborhood || place.borough].filter(Boolean).join(" · ");
    if (og) {
      // Landscape: words left, the dish's neighborhood of the ranking right (dish highlighted).
      const start = c.rank ? Math.max(0, Math.min(c.rank - 2, total - 3)) : 0;
      const rows: Row[] = ranked.slice(start, start + 3).map((v) => ({
        rank: v.rank ?? 0,
        dish: v.title,
        place: v.placeName ?? "",
        score: Math.round(v.score),
        highlight: v.id === c.id,
      }));
      return respondOg(
        ogPoster({
          bg: shareGradient(subcategory.slug),
          emoji: subcategory.emoji,
          kicker,
          title: c.title,
          tagline,
          url: `faves.bandana.com/c/${id}`,
          rows,
        }),
      );
    }
    // Portrait: the dish as the headline, then the top 5 with this dish highlighted (or appended).
    const top: Row[] = ranked.slice(0, N).map((v, i) => ({
      rank: v.rank ?? i + 1,
      dish: v.title,
      place: [v.placeName, v.neighborhood || v.borough].filter(Boolean).join(" · "),
      score: Math.round(v.score),
      highlight: v.id === c.id,
    }));
    if (c.rank && c.rank > N) {
      top.pop();
      top.push({
        rank: c.rank,
        dish: c.title,
        place: [place.name, place.neighborhood || place.borough].filter(Boolean).join(" · "),
        score: Math.round(c.score),
        highlight: true,
      });
    }
    return respond(
      poster({
        bg: shareGradient(subcategory.slug),
        glyph: { emoji: subcategory.emoji },
        kicker,
        title: c.title,
        tagline: tagline + " — where it lands on the board:",
        url: `faves.bandana.com/c/${id}`,
        rows: top,
        wrapTitle: true,
      }),
    );
  }

  // Personal per-category "my top 5" — id = @handle, ?sub=<slug>. Labeled with the display name.
  if (kind === "personal") {
    const sub = new URL(_req.url).searchParams.get("sub") ?? "";
    const profile = sub ? repo.getProfile(id) : null;
    const rl = sub ? repo.getRankedList(sub) : null;
    if (!profile || !rl) return new Response("Not found", { status: 404 });
    const firstName = (profile.name || "?").split(" ")[0] || profile.name;
    const personal = repo.getPersonalRankedListByHandle(id, sub);
    // Order is the user's own; the number shown is each dish's COMMUNITY score (more meaningful than a
    // sparse personal win-rate), omitted when the dish isn't ranked yet so we never print a stark 0.
    const gScore = new Map([...rl.ranked, ...rl.contenders].map((v) => [v.id, v.score]));
    const rows: Row[] = personal.slice(0, N).map((v, i) => {
      const g = Math.round(gScore.get(v.id) ?? 0);
      return {
        rank: i + 1,
        dish: v.title,
        place: [v.placeName, v.neighborhood || v.borough].filter(Boolean).join(" · "),
        score: g > 0 ? g : undefined,
      };
    });
    if (rows.length === 0)
      return respond(notFoundPoster(`${firstName}'s ${rl.subcategory.name}`, "Rank a few to fill this out."));
    if (og)
      return respondOg(
        ogPoster({
          bg: shareGradient(sub),
          emoji: rl.subcategory.emoji,
          kicker: `${firstName.toUpperCase()}'S TOP ${rows.length}`,
          title: rl.subcategory.name,
          tagline: `${firstName}'s personal ${rl.subcategory.name.toLowerCase()} ranking on Bandana Faves.`,
          url: `faves.bandana.com/u/${id}`,
          rows,
        }),
      );
    return respond(
      poster({
        bg: shareGradient(sub),
        glyph: { emoji: rl.subcategory.emoji },
        kicker: `${firstName.toUpperCase()}'S TOP ${rows.length}`,
        title: rl.subcategory.name,
        tagline: `${firstName}'s personal ${rl.subcategory.name.toLowerCase()} ranking.`,
        url: `faves.bandana.com/u/${id}`,
        rows,
      }),
    );
  }

  if (kind === "category") {
    const list = repo.getRankedList(id);
    if (!list) return new Response("Not found", { status: 404 });
    const rows: Row[] = list.ranked.slice(0, N).map((v, i) => ({
      rank: v.rank ?? i + 1,
      dish: v.title,
      place: [v.placeName, v.neighborhood || v.borough].filter(Boolean).join(" · "),
      score: Math.round(v.score),
    }));
    if (rows.length === 0) {
      if (og)
        return respondOg(
          ogPoster({
            bg: shareGradient(id),
            emoji: list.subcategory.emoji,
            kicker: "BEST IN NYC",
            title: list.subcategory.name,
            tagline: "Be the first to rank it.",
            url: `faves.bandana.com/nyc/${id}`,
            rows: [],
          }),
        );
      return respond(notFoundPoster(`Best ${list.subcategory.name} in NYC`, "Be the first to rank it."));
    }
    if (og)
      return respondOg(
        ogPoster({
          bg: shareGradient(id),
          emoji: list.subcategory.emoji,
          kicker: "BEST IN NYC · RANKED BY DUELS",
          title: list.subcategory.name,
          tagline: "The best in the city, ranked head-to-head — never star averages.",
          url: `faves.bandana.com/nyc/${id}`,
          rows,
        }),
      );
    return respond(
      poster({
        bg: shareGradient(id),
        glyph: { emoji: list.subcategory.emoji },
        kicker: `TOP ${Math.min(N, rows.length)} IN NYC`,
        title: list.subcategory.name,
        tagline: "The best in the city, ranked head-to-head.",
        url: `faves.bandana.com/nyc/${id}`,
        rows,
      }),
    );
  }

  if (kind === "pinnacle") {
    const profile = repo.getProfile(id);
    if (!profile) return new Response("Not found", { status: 404 });
    const first = (profile.name || "?").trim().charAt(0).toUpperCase() || "?";
    const firstName = profile.name.split(" ")[0] || profile.name;
    const rows: Row[] = profile.pinnacle.slice(0, N).map((p, i) => ({
      rank: i + 1,
      dish: p.title,
      place: [p.placeName, p.subName].filter(Boolean).join(" · "),
      score: Math.round(p.score),
    }));
    if (rows.length === 0) {
      // Keep unfurls landscape even when there's nothing pinned yet.
      if (og)
        return respondOg(
          ogPoster({
            bg: GREEN_BG,
            emoji: "🏔️",
            kicker: "BANDANA FAVES",
            title: `${firstName}'s Pinnacle`,
            tagline: "All-time NYC favorites — nothing pinned yet.",
            url: `faves.bandana.com/u/${id}`,
            rows: [],
          }),
        );
      return respond(notFoundPoster(`${firstName}'s Pinnacle`, "No favorites pinned yet."));
    }
    if (og)
      return respondOg(
        ogPoster({
          bg: GREEN_BG,
          emoji: "🏔️",
          kicker: "ALL-TIME NYC FAVORITES",
          title: `${firstName}'s Top ${rows.length}`,
          tagline: `${firstName}'s all-time favorite dishes on Bandana Faves.`,
          url: `faves.bandana.com/u/${id}`,
          rows,
        }),
      );
    return respond(
      poster({
        bg: GREEN_BG,
        glyph: { monogram: first },
        kicker: "MY TOP NYC DISHES",
        title: `${firstName}'s Top ${rows.length}`,
        tagline: "My all-time NYC favorites.",
        url: `faves.bandana.com/u/${id}`,
        rows,
      }),
    );
  }

  return new Response("Not found", { status: 404 });
}
