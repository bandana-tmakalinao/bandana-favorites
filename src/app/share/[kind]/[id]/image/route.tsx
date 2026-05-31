import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getRepo } from "@/db/repo";

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

// Gradient backdrops (the "story" color field — bold + saturated, Wrapped energy).
const CORAL_BG = "linear-gradient(150deg, #f59568 0%, #ed7f54 45%, #d9551f 100%)";
const GREEN_BG = "linear-gradient(150deg, #18a98c 0%, #009275 50%, #00715b 100%)";

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

type Row = { rank: number; dish: string; place: string; score: number };

function rowEl(r: Row) {
  const sc = scoreColor(r.score);
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
        boxShadow: "0 10px 26px rgba(60,20,0,0.16)",
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

      {/* score */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 110 }}>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 58, color: sc, lineHeight: 1 }}>
          {r.score}
        </div>
        <div style={{ display: "flex", fontFamily: BODY, fontSize: 18, fontWeight: 700, letterSpacing: 2, color: "#b7af9f" }}>
          / 100
        </div>
      </div>
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
}) {
  const tlen = opts.title.length;
  const titleSize = tlen > 18 ? 88 : tlen > 12 ? 110 : 132;
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
            lineHeight: 0.98,
            marginTop: 4,
            whiteSpace: "nowrap",
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

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const repo = getRepo();

  if (kind === "category") {
    const list = repo.getRankedList(id);
    if (!list) return new Response("Not found", { status: 404 });
    const rows: Row[] = list.ranked.slice(0, N).map((v, i) => ({
      rank: v.rank ?? i + 1,
      dish: v.title,
      place: [v.placeName, v.neighborhood || v.borough].filter(Boolean).join(" · "),
      score: Math.round(v.score),
    }));
    if (rows.length === 0) return respond(notFoundPoster(`Best ${list.subcategory.name} in NYC`, "Be the first to rank it."));
    return respond(
      poster({
        bg: CORAL_BG,
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
    if (rows.length === 0) return respond(notFoundPoster(`${firstName}'s Pinnacle`, "No favorites pinned yet."));
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
