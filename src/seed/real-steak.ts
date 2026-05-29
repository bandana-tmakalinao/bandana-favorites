/**
 * Real NYC steak seed — consensus from 2025+ best-of lists (same approach as ramen/pizza).
 * SOURCE DATES VERIFIED 2026-05-29 (2025+ only): The Infatuation (Apr 22 2026), Eater NY
 * (Apr 20 2026), MICHELIN Guide (Jan 30 / modified May 6 2026), Time Out NY (Apr 28 2026).
 * NYT had no steak guide; crowd excluded (unverified). Coords neighborhood-approximate.
 * Generated from workflow w1q02ohvi on 2026-05-29.
 */
import data from "./real-steak.data.json";
import type { RealRamen } from "./real-ramen";

export const REAL_STEAK: RealRamen[] = data as RealRamen[];
