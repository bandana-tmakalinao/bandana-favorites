"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { resolveMapStyle } from "@/lib/mapStyle";
import { dishPath } from "@/lib/links";

export interface MapPoint {
  id: string;
  /** Dish URL parts — pins link via dishPath. */
  subSlug: string;
  slug: string;
  lat: number;
  lng: number;
  rank: number | null;
  score: number;
  title: string;
  placeName: string;
}

// Rank-driven pin color: a gold podium for the top 3, coral for the rest of the board.
function pinColor(rank: number | null): string {
  if (rank === 1) return "#efb745"; // gold
  if (rank === 2) return "#b8b3a4"; // silver
  if (rank === 3) return "#c9925f"; // bronze
  return "#ed7f54"; // coral (brand)
}

export default function MapView({ points, center }: { points: MapPoint[]; center: { lat: number; lng: number } }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("maplibre-gl").Map | undefined;
    let cancelled = false;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !ref.current) return;

      map = new maplibregl.Map({
        container: ref.current,
        style: resolveMapStyle() as never,
        center: [center.lng, center.lat],
        zoom: 11,
        attributionControl: false,
      });
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      const bounds = new maplibregl.LngLatBounds();
      for (const p of points) {
        const color = pinColor(p.rank);
        // Outer element = MapLibre's positioning target (it owns its transform). The teardrop visual
        // lives on an INNER element so hover-scaling never fights MapLibre's translate (no jitter).
        const el = document.createElement("div");
        el.style.cursor = "pointer";
        const pin = document.createElement("a");
        pin.href = dishPath(p);
        pin.style.cssText = `display:grid;place-items:center;width:30px;height:30px;
          border-radius:50% 50% 50% 0;transform:rotate(-45deg);transform-origin:center;
          background:${color};box-shadow:0 2px 6px rgba(35,28,22,.35);
          border:2px solid #fff;text-decoration:none;transition:transform .12s ease;`;
        const label = document.createElement("span");
        label.textContent = p.rank ? String(p.rank) : "•";
        label.style.cssText = `transform:rotate(45deg);color:#fff;font-weight:800;font-size:12px;line-height:1;`;
        pin.appendChild(label);
        el.appendChild(pin);

        const popup = new maplibregl.Popup({ offset: 24, closeButton: false, closeOnClick: false })
          .setLngLat([p.lng, p.lat])
          .setHTML(
            `<div style="font-family:'Helvetica Neue',Helvetica,system-ui;min-width:160px">
               <div style="font-weight:700;color:#231c16">${escapeHtml(p.title)}</div>
               <div style="color:#7a7264;font-size:12px">${escapeHtml(p.placeName)}</div>
               <div style="margin-top:4px;font-size:12px;color:#231c16">Score <b>${Math.round(p.score)}</b>${p.rank ? ` · #${p.rank}` : ""}</div>
             </div>`,
          );
        el.addEventListener("mouseenter", () => {
          pin.style.transform = "rotate(-45deg) scale(1.15)";
          popup.addTo(map!);
        });
        el.addEventListener("mouseleave", () => {
          pin.style.transform = "rotate(-45deg)";
          popup.remove();
        });
        new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([p.lng, p.lat]).addTo(map);
        bounds.extend([p.lng, p.lat]);
      }
      if (points.length) map.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 0 });
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points, center]);

  return (
    <div
      ref={ref}
      className="h-[62vh] w-full overflow-hidden rounded-2xl border border-[var(--color-border)] shadow-[0_4px_24px_-12px_rgba(35,28,22,0.25)]"
    />
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
