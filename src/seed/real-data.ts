/**
 * Registry of all real, consensus-seeded NYC food data, keyed by subcategory slug.
 * Each list is synthesized from 2025+ best-of sources only (see docs/data-sourcing-research.md and
 * the per-list research workflows). Adding a food = drop in its real-<slug>.data.json + one line here.
 * Coordinates are exact (US Census geocoded) where an address resolved, else neighborhood-approximate.
 */
import type { RealRamen } from "./real-ramen";

import ramen from "./real-ramen.data.json";
import pizza from "./real-pizza.data.json";
import bagel from "./real-bagels.data.json";
import iceCream from "./real-ice-cream.data.json";
import steak from "./real-steak.data.json";
import pastrami from "./real-pastrami.data.json";
import choppedCheese from "./real-chopped-cheese.data.json";
import baconEggCheese from "./real-bacon-egg-cheese.data.json";
import halalCart from "./real-halal-cart.data.json";
import cheesecake from "./real-cheesecake.data.json";
import bwCookie from "./real-black-and-white-cookie.data.json";
import hotDog from "./real-hot-dog.data.json";
import soupDumplings from "./real-soup-dumplings.data.json";
import dimSum from "./real-dim-sum.data.json";
import cheeseburger from "./real-cheeseburger.data.json";
import tacos from "./real-tacos.data.json";
import koreanFriedChicken from "./real-korean-fried-chicken.data.json";
import lobsterRoll from "./real-lobster-roll.data.json";
import pho from "./real-pho.data.json";
import cannoli from "./real-cannoli.data.json";
import dosa from "./real-dosa.data.json";

const as = (d: unknown) => d as RealRamen[];

export const REAL_DATA: Record<string, RealRamen[]> = {
  pizza: as(pizza),
  bagel: as(bagel),
  "black-and-white-cookie": as(bwCookie),
  pastrami: as(pastrami),
  "chopped-cheese": as(choppedCheese),
  "bacon-egg-cheese": as(baconEggCheese),
  ramen: as(ramen),
  "soup-dumplings": as(soupDumplings),
  "dim-sum": as(dimSum),
  tacos: as(tacos),
  "korean-fried-chicken": as(koreanFriedChicken),
  pho: as(pho),
  dosa: as(dosa),
  cheeseburger: as(cheeseburger),
  steak: as(steak),
  "lobster-roll": as(lobsterRoll),
  "halal-cart": as(halalCart),
  "hot-dog": as(hotDog),
  cheesecake: as(cheesecake),
  cannoli: as(cannoli),
  "ice-cream": as(iceCream),
};
