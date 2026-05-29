/**
 * Real NYC pizza seed — consensus compiled from 2025+ best-of lists plus Dave Portnoy's One Bite.
 * Same approach as ramen: record FACTS (which spots each source recommends + addresses) and derive
 * OUR OWN consensus from how many sources feature each — not a copy of any single ranking.
 *
 * SOURCE DATES VERIFIED 2026-05-29 (only 2025+ used): The Infatuation (May 27 2026), MICHELIN Guide
 * (Apr 30 2026), Eater NY (Oct 31 2025), Time Out NY (Oct 23 2025), NYT "22 Best Pizza" (May 27 2025,
 * confirmed via West Side Rag), r/FoodNYC crowd thread (Oct 14 2025), and Dave Portnoy / One Bite
 * (scores current May 2026, included at 8.0+ as a recommendation signal). EXCLUDED as pre-2025:
 * Serious Eats "Best Pizza Slices" (Mar 31 2024) — used only to corroborate addresses.
 * Coordinates are neighborhood-approximate pending Overture/NYC OpenData reconciliation.
 *
 * Generated from workflows wips9hp2v + wx0m62o19 on 2026-05-29.
 */
import data from "./real-pizza.data.json";
import type { RealRamen } from "./real-ramen";

export const REAL_PIZZA: RealRamen[] = data as RealRamen[];
