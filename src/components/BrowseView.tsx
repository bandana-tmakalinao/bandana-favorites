"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ConfidenceDot, PhotoThumb, RankBadge, ScoreBadge } from "./bits";
import ShareButton from "./ShareButton";
import type { ContenderView } from "@/lib/types";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[62vh] place-items-center rounded-2xl border border-[var(--color-border)] text-sm text-[var(--color-ink-dim)]">
      Loading map…
    </div>
  ),
});

function Row({ v }: { v: ContenderView }) {
  return (
    <Link
      href={`/c/${v.id}`}
      className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition duration-150 hover:-translate-y-px hover:border-[var(--color-brand)] hover:shadow-[0_6px_20px_-12px_rgba(35,28,22,0.35)]"
    >
      <RankBadge rank={v.rank} />
      {v.photoUrl && <PhotoThumb url={v.photoUrl} alt={v.title} className="h-14 w-14 shrink-0" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold tracking-tight">{v.title}</span>
        <span className="block truncate text-sm text-[var(--color-ink-dim)]">
          {v.placeName} · {v.neighborhood}
        </span>
        <span className="mt-1 flex items-center gap-2 text-xs text-[var(--color-ink-dim)]">
          <ConfidenceDot tier={v.tier} withLabel />
          {v.comparisonCount > 0 && <span>· {v.comparisonCount} duels</span>}
        </span>
      </span>
      <ScoreBadge score={v.score} standing={v.standing} />
    </Link>
  );
}

/** A personal-ranking row: same look as Row, but with an inline "re-rank" action (so the whole row
 *  isn't one link — a nested <a> is invalid). Re-rank pulls the dish out and re-places it via duels. */
function MineRow({ v, sub }: { v: ContenderView; sub?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <RankBadge rank={v.rank} />
      {v.photoUrl && <PhotoThumb url={v.photoUrl} alt={v.title} className="h-14 w-14 shrink-0" />}
      <Link href={`/c/${v.id}`} className="min-w-0 flex-1">
        <span className="block truncate font-bold tracking-tight">{v.title}</span>
        <span className="block truncate text-sm text-[var(--color-ink-dim)]">
          {v.placeName} · {v.neighborhood}
        </span>
      </Link>
      {sub && (
        <Link
          href={`/duel?sub=${sub}&target=${v.id}`}
          title="Re-rank this dish"
          className="shrink-0 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-ink-dim)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
        >
          ↻ Re-rank
        </Link>
      )}
      <ScoreBadge score={v.score} standing={v.standing} />
    </div>
  );
}

const toggle = (active: boolean) =>
  `rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
    active ? "bg-[var(--color-brand)] text-white" : "text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
  }`;

export default function BrowseView({
  ranked,
  provisional,
  center,
  personal = [],
  signedIn = false,
  subName,
  sub,
  meHandle,
  meName,
}: {
  ranked: ContenderView[];
  provisional: ContenderView[];
  center: { lat: number; lng: number };
  personal?: ContenderView[];
  signedIn?: boolean;
  subName: string;
  sub?: string;
  meHandle?: string;
  meName?: string;
}) {
  const [source, setSource] = useState<"overall" | "mine">("overall");
  const [view, setView] = useState<"list" | "map">("list");
  const points = ranked.map((v) => ({
    id: v.id, lat: v.lat, lng: v.lng, rank: v.rank, score: v.score, title: v.title, placeName: v.placeName,
  }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {signedIn && (
          <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
            <button onClick={() => setSource("overall")} className={toggle(source === "overall")}>
              Overall
            </button>
            <button onClick={() => setSource("mine")} className={toggle(source === "mine")}>
              Mine
            </button>
          </div>
        )}
        {source === "overall" && (
          <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
            <button onClick={() => setView("list")} className={toggle(view === "list")}>
              List
            </button>
            <button onClick={() => setView("map")} className={toggle(view === "map")}>
              Map
            </button>
          </div>
        )}
      </div>

      {source === "mine" ? (
        personal.length > 0 ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[var(--color-ink-dim)]">
                Your personal ranking, from the {subName.toLowerCase()} you&apos;ve dueled.
              </p>
              {meHandle && (
                <ShareButton
                  kind="personal"
                  id={meHandle}
                  query={sub ? `sub=${sub}` : undefined}
                  title={`${meName ? `${meName}'s` : "My"} ${subName} top ${Math.min(5, personal.length)}`}
                  pageHref={`/u/${meHandle}`}
                  variant="ghost"
                  label="Share my top 5"
                />
              )}
            </div>
            {personal.map((v) => (
              <MineRow key={v.id} v={v} sub={sub} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-sm text-[var(--color-ink-dim)]">
            Rate or duel some {subName.toLowerCase()} and your personal ranking shows up here.
          </div>
        )
      ) : view === "list" ? (
        <div className="space-y-2">
          {ranked.map((v) => (
            <Row key={v.id} v={v} />
          ))}
          {provisional.length > 0 && (
            <div className="pt-6">
              <h2 className="mb-1 text-sm font-semibold text-[var(--color-ink-dim)]">Contenders — earning their rank</h2>
              <p className="mb-3 text-xs text-[var(--color-ink-dim)]">
                Not enough trusted votes yet to place on the board. Duel them to help.
              </p>
              <div className="space-y-2 opacity-80">
                {provisional.map((v) => (
                  <Row key={v.id} v={v} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <MapView points={points} center={center} />
      )}
    </div>
  );
}
