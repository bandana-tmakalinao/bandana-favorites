import { ImageResponse } from "next/og";
import { getRepo } from "@/db/repo";

// getRepo() touches the node-only fs/db layer, so this OG route runs on the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const W = 1080;
const H = 1350;

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

type Row = { rank: number; dish: string; place: string; score: number };

function rowEl(r: Row, isTop: boolean) {
  const sc = scoreColor(r.score);
  return (
    <div
      key={r.rank}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        width: 952,
        height: isTop ? 96 : 84,
        padding: isTop ? "0 20px" : "0 4px",
        backgroundColor: isTop ? "#ffffff" : "transparent",
        border: isTop ? `1px solid ${BORDER}` : "none",
        borderRadius: isTop ? 20 : 0,
      }}
    >
      {/* medal / numeral — Satori rejects backgroundImage:"none", so only set it when a medal exists */}
      <div
        style={{
          display: "flex",
          width: 68,
          height: 68,
          borderRadius: 34,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 34,
          fontWeight: 700,
          ...(MEDAL[r.rank]
            ? { backgroundImage: MEDAL[r.rank], color: "#ffffff" }
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
            fontSize: isTop ? 44 : 38,
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
            fontSize: 26,
            color: DIM,
            marginTop: 4,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {r.place}
        </div>
      </div>

      {/* score badge (bordered box, matches the site's ScoreBadge) */}
      <div
        style={{
          display: "flex",
          width: isTop ? 104 : 92,
          height: isTop ? 104 : 92,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: isTop ? 50 : 44,
          fontWeight: 800,
          border: `3px solid ${sc}`,
          color: sc,
          backgroundColor: "#ffffff",
        }}
      >
        {r.score}
      </div>
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
  const titleSize = opts.title.length > 16 ? 64 : 84;
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
      {/* header band — gradient via backgroundImage (Satori supports linear-gradient strings) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "60px 64px 40px",
          backgroundColor: opts.bandFrom,
          backgroundImage: `linear-gradient(135deg, ${opts.bandFrom} 0%, ${opts.bandTo} 100%)`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {opts.emoji ? (
            <div style={{ display: "flex", fontSize: 100, lineHeight: 1 }}>{opts.emoji}</div>
          ) : (
            <div
              style={{
                display: "flex",
                width: 108,
                height: 108,
                borderRadius: 54,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: CORAL,
                color: "#ffffff",
                fontSize: 54,
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
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: 4,
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
                lineHeight: 1.02,
                marginTop: 4,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {opts.title}
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: DIM,
            marginTop: 18,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {opts.tagline}
        </div>
      </div>

      {/* list */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "12px 48px",
          gap: opts.rows.length >= 9 ? 0 : 4,
          justifyContent: opts.rows.length >= 9 ? "flex-start" : "space-between",
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
          padding: "28px 64px 52px",
          borderTop: `2px solid ${BORDER}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: CORAL,
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            B
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: INK }}>
              Bandana Faves
            </div>
            <div style={{ display: "flex", fontSize: 23, color: DIM }}>Ranked by duels, not stars</div>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 27, fontWeight: 700, color: CORAL }}>{opts.url}</div>
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
    const rows: Row[] = list.ranked.slice(0, 10).map((v, i) => ({
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
            kicker: `Top ${rows.length} in NYC`,
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
    const rows: Row[] = profile.pinnacle.slice(0, 10).map((p, i) => ({
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
            kicker: "NYC Dishes · Bandana Faves",
            title: `${firstName}'s Top ${rows.length}`,
            tagline: `${firstName}'s all-time NYC favorites.`,
            url: `faves.bandana.com/u/${id}`,
            rows,
          });
    return new ImageResponse(tree, { width: W, height: H });
  }

  return new Response("Not found", { status: 404 });
}
