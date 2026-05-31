import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getRepo } from "@/db/repo";

// getRepo() touches the node-only fs/db layer, so this OG route runs on the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const W = 1080;
const H = 1350;
const N = 5; // Top 5 — cleaner + more breathing room than a packed Top 10.

// Brand palette (hex only — Satori has no CSS vars).
const INK = "#231c16";
const DIM = "#7a7264";
const CREAM = "#f7f5ef";
const CREAM2 = "#f0ede4";
const BORDER = "#e6e1d6";
const CORAL = "#ed7f54";

const MEDAL: Record<number, string> = {
  1: "linear-gradient(135deg,#f6d36b,#e0a93c)",
  2: "linear-gradient(135deg,#dcd9cf,#b3ad9d)",
  3: "linear-gradient(135deg,#e2b483,#c2895a)",
};

function scoreColor(score: number): string {
  if (score >= 75) return "#009275"; // bandana green
  if (score >= 60) return "#c79a2e"; // darkened gold (raw gold is invisible on cream)
  return "#7a7264";
}

// Embed the logo once as a data URI. We use a sips-re-encoded copy (logo-share.png) because
// resvg (Satori's image decoder) rejects some PNG color-profile/metadata variants with
// "Unsupported image type: unknown"; the re-encode strips that. Falls back to the coral "B"
// tile (brandTile) if the file is missing or unreadable, so the poster always renders.
let LOGO: string | null | undefined;
function logo(): string | null {
  if (LOGO === undefined) {
    try {
      const buf = readFileSync(join(process.cwd(), "public", "logo-share.png"));
      LOGO = `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      LOGO = null;
    }
  }
  return LOGO;
}

type Row = { rank: number; dish: string; place: string; score: number };

function rowEl(r: Row, isTop: boolean) {
  const sc = scoreColor(r.score);
  const medal = MEDAL[r.rank];
  return (
    <div
      key={r.rank}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        width: 952,
        padding: "20px 24px",
        borderRadius: 28,
        backgroundColor: isTop ? "#ffffff" : "transparent",
        border: isTop ? `2px solid ${CORAL}` : `1px solid ${BORDER}`,
        boxShadow: isTop ? "0 8px 22px rgba(224,128,84,0.20)" : "none",
      }}
    >
      {/* rank medal / numeral */}
      <div
        style={{
          display: "flex",
          width: 86,
          height: 86,
          borderRadius: 43,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 44,
          fontWeight: 800,
          ...(medal
            ? { backgroundImage: medal, color: "#ffffff" }
            : { backgroundColor: CREAM2, color: DIM }),
        }}
      >
        {r.rank}
      </div>

      {/* dish + place */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            fontSize: isTop ? 52 : 46,
            fontWeight: 700,
            color: INK,
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
            fontSize: 30,
            color: DIM,
            marginTop: 6,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          📍 {r.place}
        </div>
      </div>

      {/* score */}
      <div
        style={{
          display: "flex",
          width: 118,
          height: 118,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 58,
          fontWeight: 800,
          border: `4px solid ${sc}`,
          color: sc,
          backgroundColor: "#ffffff",
        }}
      >
        {r.score}
      </div>
    </div>
  );
}

function brandTile() {
  const l = logo();
  if (l) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={l} width={70} height={70} style={{ borderRadius: 16 }} alt="" />;
  }
  return (
    <div
      style={{
        display: "flex",
        width: 70,
        height: 70,
        borderRadius: 16,
        backgroundColor: CORAL,
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        fontSize: 40,
        fontWeight: 800,
      }}
    >
      B
    </div>
  );
}

function poster(opts: {
  bandFrom: string;
  bandTo: string;
  emoji: string | null;
  monogram: string | null;
  kicker: string;
  title: string;
  tagline: string;
  url: string;
  rows: Row[];
}) {
  const titleSize = opts.title.length > 16 ? 72 : 96;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: W,
        height: H,
        backgroundColor: CREAM,
        fontFamily: "sans-serif",
      }}
    >
      {/* header band */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "66px 64px 46px",
          backgroundColor: opts.bandFrom,
          backgroundImage: `linear-gradient(135deg, ${opts.bandFrom} 0%, ${opts.bandTo} 100%)`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {opts.emoji ? (
            <div style={{ display: "flex", fontSize: 124, lineHeight: 1 }}>{opts.emoji}</div>
          ) : (
            <div
              style={{
                display: "flex",
                width: 124,
                height: 124,
                borderRadius: 62,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: CORAL,
                color: "#ffffff",
                fontSize: 62,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {opts.monogram}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                fontSize: 31,
                fontWeight: 700,
                letterSpacing: 7,
                color: DIM,
                textTransform: "uppercase",
              }}
            >
              {opts.kicker}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: titleSize,
                fontWeight: 800,
                color: INK,
                lineHeight: 1.0,
                marginTop: 8,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {opts.title}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 33, color: DIM, marginTop: 24 }}>{opts.tagline}</div>
      </div>

      {/* the 5 rows — even gaps fill the canvas (Satori has no space-evenly; use a gap + center) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "34px 44px",
          justifyContent: "center",
          gap: 22,
        }}
      >
        {opts.rows.map((r, i) => rowEl(r, i === 0))}
      </div>

      {/* footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "26px 56px 52px",
          borderTop: `2px solid ${BORDER}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {brandTile()}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 33, fontWeight: 800, color: INK }}>
              Bandana Faves
            </div>
            <div style={{ display: "flex", fontSize: 25, color: DIM }}>Ranked by duels, not stars</div>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 29, fontWeight: 700, color: CORAL }}>{opts.url}</div>
      </div>
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
        backgroundColor: CREAM,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        padding: 80,
      }}
    >
      <div style={{ display: "flex", fontSize: 120 }}>🍴</div>
      <div style={{ display: "flex", fontSize: 60, fontWeight: 800, color: INK, marginTop: 24 }}>
        {title}
      </div>
      <div style={{ display: "flex", fontSize: 32, color: DIM, marginTop: 12 }}>{message}</div>
      <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: CORAL, marginTop: 48 }}>
        faves.bandana.com
      </div>
    </div>
  );
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
    const tree =
      rows.length === 0
        ? notFoundPoster(`Best ${list.subcategory.name} in NYC`, "Be the first to rank it.")
        : poster({
            bandFrom: "#fde7dc",
            bandTo: "#fbd9c6",
            emoji: list.subcategory.emoji,
            monogram: null,
            kicker: `Top ${Math.min(N, rows.length)} in NYC`,
            title: list.subcategory.name,
            tagline: "Ranked by head-to-head duels, not stars.",
            url: `faves.bandana.com/nyc/${id}`,
            rows,
          });
    return new ImageResponse(tree, { width: W, height: H });
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
    const tree =
      rows.length === 0
        ? notFoundPoster(`${firstName}'s Pinnacle`, "No favorites pinned yet.")
        : poster({
            bandFrom: "#fdf0cf",
            bandTo: "#f8e3a6",
            emoji: null,
            monogram: first,
            kicker: "Top NYC dishes",
            title: `${firstName}'s Top ${rows.length}`,
            tagline: `${firstName}'s all-time NYC favorites.`,
            url: `faves.bandana.com/u/${id}`,
            rows,
          });
    return new ImageResponse(tree, { width: W, height: H });
  }

  return new Response("Not found", { status: 404 });
}
