import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bandana Faves",
    short_name: "Bandana Faves",
    description: "The best food in NYC, ranked by the food — head-to-head duels, not star averages.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5ef", // warm cream (--color-bg)
    theme_color: "#ed7f54", // brand coral
    icons: [{ src: "/icon.png", sizes: "any", type: "image/png" }],
  };
}
