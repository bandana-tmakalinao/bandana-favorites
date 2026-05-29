/**
 * Real NYC ramen seed — a consensus compiled from public best-of lists (The Infatuation, Eater NY,
 * the MICHELIN Guide, NYT, Time Out, and crowd sources). We record the FACTS (which shops are
 * recommended, their addresses) and derive OUR OWN consensus order from how many lists feature each
 * shop — not a copy of any single publication's ranking. `seedQuality` drives the curator seed duels;
 * real user duels overwrite it over time. Coordinates are neighborhood-approximate pending Overture/
 * NYC OpenData reconciliation. See docs/data-sourcing-research.md.
 *
 * SOURCE DATES VERIFIED LIVE 2026-05-29 — only 2025+ lists are used (per founder policy, nothing
 * prior to 2025): The Infatuation (Jan 30 2026), MICHELIN Guide (May 14 2026), Time Out NY
 * (Sep 29 2025), NYT 100 Best (2025). EXCLUDED as pre-2025: Eater NY (Oct 18 2024), Serious Eats
 * (2018–2019). Re-verify dates before each refresh.
 *
 * Generated from workflow wnklc6k2n on 2026-05-29; consensus rebuilt to 2025+ sources only.
 */
import data from "./real-ramen.data.json";

export interface RealRamen {
  name: string;
  neighborhood: string;
  borough: string;
  address: string;
  lat: number;
  lng: number;
  signatureBowl: string;
  title?: string; // clean menu-style dish name (preferred over signatureBowl for display)
  description?: string; // short detail shown under the title
  appearsOn: string[];
  appearanceCount: number;
  seedQuality: number;
}

export const REAL_RAMEN: RealRamen[] = data as RealRamen[];
