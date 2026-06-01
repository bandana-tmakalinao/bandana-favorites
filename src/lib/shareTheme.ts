/**
 * Per-category share-poster gradients. The share image used to be coral for every food type; this
 * gives each category a backdrop that echoes its emoji (pizza→tomato, ramen→amber, matcha→jade,
 * ice-cream→pink…) so a shared poster reads as *that dish* at a glance. Hex only — Satori (next/og)
 * has no CSS-var support. Keyed by SUBCATEGORY slug; unknown slugs fall back to the coral brand.
 */
export const SHARE_CORAL = "linear-gradient(150deg, #f59568 0%, #ed7f54 45%, #d9551f 100%)";
export const SHARE_GREEN = "linear-gradient(150deg, #18a98c 0%, #009275 50%, #00715b 100%)";

export const SHARE_GRADIENT: Record<string, string> = {
  pizza: "linear-gradient(150deg, #f6894e 0%, #e8442e 45%, #b81f24 100%)", // 🍕 tomato → fire
  bagel: "linear-gradient(150deg, #e8b06a 0%, #c98a3e 50%, #946022 100%)", // 🥯 toasted sesame
  "black-and-white-cookie": "linear-gradient(150deg, #6f6f6f 0%, #3a3a3a 52%, #161616 100%)", // 🍪 mono
  pastrami: "linear-gradient(150deg, #d98a7a 0%, #b8534a 50%, #862f33 100%)", // 🥪 smoked rose
  "chopped-cheese": "linear-gradient(150deg, #f3c14b 0%, #e08a2e 50%, #bf5a1e 100%)", // 🧀 melt
  "bacon-egg-cheese": "linear-gradient(150deg, #f2a65a 0%, #e36b5a 50%, #c23b4e 100%)", // 🥓 bacon + yolk
  ramen: "linear-gradient(150deg, #f0b15a 0%, #d97b34 50%, #9c4a1e 100%)", // 🍜 amber broth
  "soup-dumplings": "linear-gradient(150deg, #f2d27a 0%, #cf9a3e 50%, #8a6524 100%)", // 🥟 steamed gold
  "dim-sum": "linear-gradient(150deg, #f2a24e 0%, #e0552e 50%, #ab1f2e 100%)", // 🥡 festive red-gold
  tacos: "linear-gradient(150deg, #d7e06a 0%, #9cc23e 45%, #e6a52e 100%)", // 🌮 lime → gold
  "korean-fried-chicken": "linear-gradient(150deg, #f08a4e 0%, #e0452e 50%, #a81f24 100%)", // 🍗 gochujang
  pho: "linear-gradient(150deg, #d99a5a 0%, #a85e34 50%, #5e3320 100%)", // 🍲 star-anise cinnamon
  dosa: "linear-gradient(150deg, #f2c25a 0%, #e0852e 50%, #b35a1e 100%)", // 🥞 golden crisp
  cheeseburger: "linear-gradient(150deg, #e8b15a 0%, #c47a34 50%, #88481f 100%)", // 🍔 bun + beef
  steak: "linear-gradient(150deg, #c66a5a 0%, #9c3a3e 50%, #5a1f28 100%)", // 🥩 deep maroon
  "lobster-roll": "linear-gradient(150deg, #f59a6e 0%, #e8553e 50%, #c2312e 100%)", // 🦞 lobster + butter
  "halal-cart": "linear-gradient(150deg, #f2c84a 0%, #e09a2e 50%, #bf6e1e 100%)", // 🍛 turmeric
  "hot-dog": "linear-gradient(150deg, #f2c24a 0%, #e07a2e 50%, #c23b2e 100%)", // 🌭 mustard + ketchup
  cheesecake: "linear-gradient(150deg, #f6d9a8 0%, #eba978 50%, #d97e6e 100%)", // 🍰 cream + berry
  cannoli: "linear-gradient(150deg, #f0e2b2 0%, #cbb070 50%, #9c7e44 100%)", // 🧁 cream + pistachio
  "ice-cream": "linear-gradient(150deg, #f8cdd8 0%, #f2a8c0 45%, #ec88b0 100%)", // 🍦 pink → cream
};

/** The poster background for a category share — its curated gradient, or the coral brand fallback. */
export function shareGradient(slug?: string): string {
  return (slug && SHARE_GRADIENT[slug]) || SHARE_CORAL;
}
