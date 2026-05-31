"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { resolveMapStyle } from "@/lib/mapStyle";

export interface CityPoint {
  id: string;
  lat: number;
  lng: number;
  score: number;
  title: string;
  placeName: string;
}
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
  const selectedRef = useRef(selected);
  const readyRef = useRef(false);
  selectedRef.current = selected;

  function draw() {
    const map = mapRef.current;
    const maplibregl = mlRef.current;
    if (!map || !maplibregl) return;
    markersRef.current.forEach((m) => m.remove());
    popupsRef.current.forEach((p) => p.remove());
    markersRef.current = [];
    popupsRef.current = [];
    const sel = selectedRef.current;
    const showAll = sel.size === 0;
    const bounds = new maplibregl.LngLatBounds();
    let any = false;
    for (const g of groups) {
      if (!showAll && !sel.has(g.key)) continue;
      for (const p of g.points) {
        // Outer element = MapLibre's positioning target (it sets transform: translate on this).
        const el = document.createElement("div");
        el.style.cursor = "pointer";
        // Inner element = the visual dot. We scale THIS on hover so we never touch the outer
        // element's transform (which would fight MapLibre's positioning and make the dot jump).
        const dot = document.createElement("a");
        dot.href = `/c/${p.id}`;
        dot.style.cssText = `display:block;width:16px;height:16px;border-radius:9999px;background:${g.color};border:2.5px solid #fff;box-shadow:0 2px 5px rgba(35,28,22,.35);transition:transform .12s ease;transform-origin:center;`;
        el.appendChild(dot);

        const popup = new maplibregl.Popup({ offset: 14, closeButton: false, closeOnClick: false })
          .setLngLat([p.lng, p.lat])
          .setHTML(
            `<div style="font-family:'Helvetica Neue',Helvetica,system-ui;min-width:150px">
               <div style="font-weight:700;color:#231c16">${esc(p.title)}</div>
               <div style="color:#7a7264;font-size:12px">${g.emoji} ${esc(g.label)} · ${esc(p.placeName)}</div>
               <div style="font-size:12px;margin-top:2px;color:#231c16">Score <b>${Math.round(p.score)}</b></div>
             </div>`,
          );
        // Show the food + restaurant on hover; remove on leave.
        el.addEventListener("mouseenter", () => {
          dot.style.transform = "scale(1.35)";
          popup.addTo(map);
        });
        el.addEventListener("mouseleave", () => {
          dot.style.transform = "scale(1)";
          popup.remove();
        });
        popupsRef.current.push(popup);
        markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map));
        bounds.extend([p.lng, p.lat]);
        any = true;
      }
    }
    if (any) map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 400 });
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
