import localFont from "next/font/local";

/**
 * The app's two faces, self-hosted from public/fonts (no network at build time) — the SAME files
 * the share posters embed (src/app/share/.../image/route.tsx), so the product and its Instagram
 * posters share one typographic identity: Archivo Black for display, Inter for everything else.
 */
export const archivo = localFont({
  src: "../../public/fonts/ArchivoBlack-400.woff",
  weight: "400",
  style: "normal",
  variable: "--font-archivo",
  display: "swap",
  // Big-headline font: if it's slow, swapping from a heavy system fallback is fine.
  fallback: ["Helvetica Neue", "Arial Black", "sans-serif"],
});

export const inter = localFont({
  src: [
    { path: "../../public/fonts/Inter-400.woff", weight: "400", style: "normal" },
    { path: "../../public/fonts/Inter-600.woff", weight: "600", style: "normal" },
    { path: "../../public/fonts/Inter-700.woff", weight: "700", style: "normal" },
    { path: "../../public/fonts/Inter-800.woff", weight: "800", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: ["Helvetica Neue", "Helvetica", "system-ui", "Arial", "sans-serif"],
});
