"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { resolveMapStyle } from "@/lib/mapStyle";
import { dishPath } from "@/lib/links";

export interface CityPoint {
  id: string;
  /** Dish URL parts — pins link via dishPath. */
  subSlug: string;
  slug: string;
  lat: number;
  lng: number;
  score: number;
  title: string;
  placeName: string;
  rank: number; // 1-based position within its food type's ranked list
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
export interface CityGroup {
  key: string;
  label: string;
  emoji: string;
  color: string;
  points: CityPoint[];
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export default function CityMap({ groups }: { groups: CityGroup[] }) {
  // Empty set = "All" (everything shown). Non-empty = show only the selected food types.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mlRef = useRef<any>(undefined);
  const markersRef = useRef<import("maplibre-gl").Marker[]>([]);
  const popupsRef = useRef<import("maplibre-gl").Popup[]>([]);
  // Persistent #1/#2/#3 "podium" popups, auto-shown when a food type is filtered in (one per place).
  const podiumPopupsRef = useRef<import("maplibre-gl").Popup[]>([]);
  const selectedRef = useRef(selected);
  const readyRef = useRef(false);
  selectedRef.current = selected;

  function draw() {
    const map = mapRef.current;
    const maplibregl = mlRef.current;
    if (!map || !maplibregl) return;
    markersRef.current.forEach((m) => m.remove());
    popupsRef.current.forEach((p) => p.remove());
    podiumPopupsRef.current.forEach((p) => p.remove());
    markersRef.current = [];
    popupsRef.current = [];
    podiumPopupsRef.current = [];
    const sel = selectedRef.current;
    const showAll = sel.size === 0;
    const bounds = new maplibregl.LngLatBounds();
    let any = false;

    // When a food type is filtered in, auto-show its podium: gather the top-3 entries grouped by place
    // (so a place holding more than one of the top 3 stacks into a single popup). Skipped on "All".
    type Pod = { rank: number; title: string; emoji: string; placeName: string; lng: number; lat: number };
    const podiumByLoc = new Map<string, Pod[]>();
    const podiumIds = new Set<string>();
    if (!showAll) {
      for (const g of groups) {
        if (!sel.has(g.key)) continue;
        for (const p of g.points) {
          if (p.rank < 1 || p.rank > 3) continue;
          const loc = `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`;
          (podiumByLoc.get(loc) ?? podiumByLoc.set(loc, []).get(loc)!).push({
            rank: p.rank, title: p.title, emoji: g.emoji, placeName: p.placeName, lng: p.lng, lat: p.lat,
          });
          podiumIds.add(p.id);
        }
      }
    }

    for (const g of groups) {
      if (!showAll && !sel.has(g.key)) continue;
      for (const p of g.points) {
        const isPodium = podiumIds.has(p.id);
        // Outer element = MapLibre's positioning target (it sets transform: translate on this).
        const el = document.createElement("div");
        el.style.cursor = "pointer";
        // Inner element = the visual dot. We scale THIS on hover so we never touch the outer
        // element's transform (which would fight MapLibre's positioning and make the dot jump).
        const dot = document.createElement("a");
        dot.href = dishPath(p);
        const sz = isPodium ? 22 : 16;
        dot.style.cssText = `display:block;width:${sz}px;height:${sz}px;border-radius:9999px;background:${g.color};border:2.5px solid #fff;box-shadow:0 2px 5px rgba(35,28,22,.35);transition:transform .12s ease;transform-origin:center;${
          isPodium ? `outline:2px solid ${g.color};outline-offset:2px;` : ""
        }`;
        el.appendChild(dot);

        const tag = p.rank <= 3 ? `${MEDAL[p.rank]} ` : `<span style="color:#7a7264">#${p.rank}</span> `;
        const popup = new maplibregl.Popup({ offset: 14, closeButton: false, closeOnClick: false })
          .setLngLat([p.lng, p.lat])
          .setHTML(
            `<div style="font-family:'Helvetica Neue',Helvetica,system-ui;min-width:150px">
               <div style="font-weight:700;color:#231c16">${tag}${esc(p.title)}</div>
               <div style="color:#7a7264;font-size:12px">${g.emoji} ${esc(g.label)} · ${esc(p.placeName)}</div>
               <div style="font-size:12px;margin-top:2px;color:#231c16">Score <b>${Math.round(p.score)}</b></div>
             </div>`,
          );
        // Hover shows the dish + place. Podium pins already have a persistent popup, so don't double up.
        el.addEventListener("mouseenter", () => {
          dot.style.transform = "scale(1.3)";
          if (!isPodium) popup.addTo(map);
        });
        el.addEventListener("mouseleave", () => {
          dot.style.transform = "scale(1)";
          if (!isPodium) popup.remove();
        });
        popupsRef.current.push(popup);
        markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map));
        bounds.extend([p.lng, p.lat]);
        any = true;
      }
    }

    // Persistent podium popups — one per place, medals stacked (#1, then #2, then #3). To declutter
    // when winners sit close together, each popup is anchored on its FAR side from the podium's
    // centroid (so they fan outward) with a longer tail — instead of all stacking straight up.
    const podGroups = [...podiumByLoc.values()];
    const cx = podGroups.reduce((s, e) => s + e[0].lng, 0) / (podGroups.length || 1);
    const cy = podGroups.reduce((s, e) => s + e[0].lat, 0) / (podGroups.length || 1);
    const anchorFor = (lng: number, lat: number): import("maplibre-gl").PositionAnchor => {
      const dx = lng - cx;
      const dy = lat - cy;
      if (Math.abs(dx) < 1e-7 && Math.abs(dy) < 1e-7) return "bottom";
      const a = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360; // 0 = east, 90 = north
      if (a < 22.5 || a >= 337.5) return "left"; // point east of center → popup to its right
      if (a < 67.5) return "bottom-left"; // NE
      if (a < 112.5) return "bottom"; // N
      if (a < 157.5) return "bottom-right"; // NW
      if (a < 202.5) return "right"; // W
      if (a < 247.5) return "top-right"; // SW
      if (a < 292.5) return "top"; // S
      return "top-left"; // SE
    };
    for (const entries of podGroups) {
      entries.sort((a, b) => a.rank - b.rank);
      const rows = entries
        .map(
          (e) =>
            `<div style="display:flex;gap:6px;align-items:baseline;line-height:1.3">
               <span style="font-size:15px">${MEDAL[e.rank]}</span>
               <span style="font-weight:700;color:#231c16">${esc(e.title)}</span>
               <span style="font-size:12px">${e.emoji}</span>
             </div>`,
        )
        .join("");
      const popup = new maplibregl.Popup({
        anchor: anchorFor(entries[0].lng, entries[0].lat),
        offset: 22,
        closeButton: false,
        closeOnClick: false,
        maxWidth: "220px",
      })
        .setLngLat([entries[0].lng, entries[0].lat])
        .setHTML(
          `<div style="font-family:'Helvetica Neue',Helvetica,system-ui;min-width:160px">
             ${rows}
             <div style="color:#7a7264;font-size:11px;margin-top:3px">${esc(entries[0].placeName)}</div>
           </div>`,
        )
        .addTo(map);
      podiumPopupsRef.current.push(popup);
    }

    if (any) map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 400 });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !containerRef.current) return;
      mlRef.current = maplibregl;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: resolveMapStyle() as never,
        center: [-73.97, 40.73],
        zoom: 10.5,
        attributionControl: false,
      });
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;
      map.on("load", () => {
        readyRef.current = true;
        draw();
      });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (readyRef.current) draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Tap a food: if we're on "All", start a fresh filter with just it; otherwise add/remove it.
  const toggle = (k: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const pillCls = (active: boolean, dimmed: boolean) =>
    `flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
      active
        ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-ink)] shadow-sm"
        : dimmed
          ? "border-transparent bg-transparent text-[var(--color-ink-dim)] opacity-50 hover:opacity-90"
          : "border-[var(--color-border)] bg-[var(--color-surface)]"
    }`;

  const showAll = selected.size === 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={() => setSelected(new Set())} className={pillCls(showAll, false)}>
          {showAll ? "★ All foods" : "Show all"}
        </button>
        {groups.map((g) => {
          const on = selected.has(g.key);
          return (
            <button key={g.key} onClick={() => toggle(g.key)} className={pillCls(on, !showAll && !on)}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />
              {g.emoji} {g.label}
              <span className="text-xs text-[var(--color-ink-dim)]">{g.points.length}</span>
            </button>
          );
        })}
      </div>
      <div
        ref={containerRef}
        className="h-[70vh] w-full overflow-hidden rounded-2xl border border-[var(--color-border)] shadow-[0_4px_24px_-12px_rgba(35,28,22,0.25)]"
      />
    </div>
  );
}
