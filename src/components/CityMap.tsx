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
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(groups.map((g) => g.key)));
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mlRef = useRef<any>(undefined); // the maplibre-gl module (its default-export type is awkward)
  const markersRef = useRef<import("maplibre-gl").Marker[]>([]);
  const enabledRef = useRef(enabled);
  const readyRef = useRef(false);
  enabledRef.current = enabled;

  function draw() {
    const map = mapRef.current;
    const maplibregl = mlRef.current;
    if (!map || !maplibregl) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    const en = enabledRef.current;
    const bounds = new maplibregl.LngLatBounds();
    let any = false;
    for (const g of groups) {
      if (!en.has(g.key)) continue;
      for (const p of g.points) {
        const el = document.createElement("a");
        el.href = `/c/${p.id}`;
        el.title = `${p.title} — ${p.placeName}`;
        el.style.cssText = `display:block;width:16px;height:16px;border-radius:9999px;background:${g.color};border:2.5px solid #fff;box-shadow:0 2px 5px rgba(35,28,22,.35);cursor:pointer;transition:transform .12s ease;`;
        el.onmouseenter = () => (el.style.transform = "scale(1.3)");
        el.onmouseleave = () => (el.style.transform = "scale(1)");
        const popup = new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(
          `<div style="font-family:'Helvetica Neue',Helvetica,system-ui;min-width:150px">
             <div style="font-weight:700;color:#231c16">${esc(p.title)}</div>
             <div style="color:#7a7264;font-size:12px">${esc(p.placeName)} · ${g.emoji} ${esc(g.label)}</div>
             <div style="font-size:12px;margin-top:2px;color:#231c16">Score <b>${Math.round(p.score)}</b></div>
           </div>`,
        );
        markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map));
        bounds.extend([p.lng, p.lat]);
        any = true;
      }
    }
    if (any) map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 300 });
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
  }, [enabled]);

  const toggle = (k: string) =>
    setEnabled((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {groups.map((g) => {
          const on = enabled.has(g.key);
          return (
            <button
              key={g.key}
              onClick={() => toggle(g.key)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                on
                  ? "border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm"
                  : "border-transparent bg-transparent text-[var(--color-ink-dim)] opacity-50 hover:opacity-80"
              }`}
            >
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
