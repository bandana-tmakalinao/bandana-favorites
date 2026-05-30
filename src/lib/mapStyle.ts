/**
 * The basemap style for every map in the app.
 *
 * Default: CARTO "Positron" — a clean, muted, low-ink raster basemap that lets coral pins pop
 * (the same premium look The Infatuation / Eater maps use), keyless and free with attribution.
 * Production can override with NEXT_PUBLIC_MAP_STYLE (a PMTiles / MapTiler / Protomaps URL).
 */
export const POSITRON_STYLE = {
  version: 8 as const,
  sources: {
    carto: {
      type: "raster" as const,
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    // Warm cream backdrop matching the page so any tile gaps blend into the design.
    { id: "bg", type: "background" as const, paint: { "background-color": "#f7f5ef" } },
    { id: "carto", type: "raster" as const, source: "carto", minzoom: 0, maxzoom: 20 },
  ],
};

/** Resolve the env override (production) or fall back to the keyless Positron default. */
export function resolveMapStyle(): unknown {
  const env = process.env.NEXT_PUBLIC_MAP_STYLE;
  return env && env.startsWith("http") ? env : POSITRON_STYLE;
}
