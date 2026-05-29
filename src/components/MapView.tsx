"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  rank: number | null;
  score: number;
  title: string;
  placeName: string;
}

// Keyless OSM raster style for local dev. Production: set NEXT_PUBLIC_MAP_STYLE to a PMTiles/MapTiler URL.
const KEYLESS_OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm", minzoom: 0, maxzoom: 19 }],
};

function pinColor(score: number): string {
  if (score >= 75) return "#3ddc84";
  if (score >= 60) return "#ffc24b";
  return "#9aa0b3";
}

export default function MapView({ points, center }: { points: MapPoint[]; center: { lat: number; lng: number } }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("maplibre-gl").Map | undefined;
    let cancelled = false;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !ref.current) return;
      const envStyle = process.env.NEXT_PUBLIC_MAP_STYLE;
      const style = envStyle && envStyle.startsWith("http") ? envStyle : (KEYLESS_OSM_STYLE as unknown as string);

      map = new maplibregl.Map({
        container: ref.current,
        style: style as never,
        center: [center.lng, center.lat],
        zoom: 11,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      const bounds = new maplibregl.LngLatBounds();
      for (const p of points) {
        const el = document.createElement("a");
        el.href = `/c/${p.id}`;
        el.textContent = p.rank ? String(p.rank) : "•";
        el.style.cssText = `display:grid;place-items:center;width:26px;height:26px;border-radius:9999px;
          background:${pinColor(p.score)};color:#0b0b0f;font-weight:800;font-size:12px;
          border:2px solid #0b0b0f;box-shadow:0 1px 4px rgba(0,0,0,.5);cursor:pointer;text-decoration:none;`;
        const popup = new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(
          `<div style="font-family:system-ui;min-width:160px">
             <div style="font-weight:700">${escapeHtml(p.title)}</div>
             <div style="color:#666;font-size:12px">${escapeHtml(p.placeName)}</div>
             <div style="margin-top:4px;font-size:12px">Score <b>${Math.round(p.score)}</b>${p.rank ? ` · #${p.rank}` : ""}</div>
           </div>`,
        );
        new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
        bounds.extend([p.lng, p.lat]);
      }
      if (points.length) map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 0 });
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points, center]);

  return (
    <div
      ref={ref}
      className="h-[62vh] w-full overflow-hidden rounded-xl border border-[var(--color-border)]"
    />
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
