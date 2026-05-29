/**
 * Real NYC ramen seed — a consensus compiled from public best-of lists (The Infatuation, Eater NY,
 * the MICHELIN Guide, NYT, Time Out, and crowd sources). We record the FACTS (which shops are
 * recommended, their addresses) and derive OUR OWN consensus order from how many lists feature each
 * shop — not a copy of any single publication's ranking. `seedQuality` drives the curator seed duels;
 * real user duels overwrite it over time. Coordinates are neighborhood-approximate pending Overture/
 * NYC OpenData reconciliation. See docs/data-sourcing-research.md.
 *
 * Generated from workflow wnklc6k2n on 2026-05-29.
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
  appearsOn: string[];
  appearanceCount: number;
  seedQuality: number;
}

export const REAL_RAMEN: RealRamen[] = data as RealRamen[];
