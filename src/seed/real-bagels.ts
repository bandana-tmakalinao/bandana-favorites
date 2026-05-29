/**
 * Real NYC bagels seed — consensus from 2025+ best-of lists (same approach as ramen/pizza).
 * SOURCE DATES VERIFIED 2026-05-29 (2025+ only): The Infatuation (Mar 13 2026), Eater NY
 * (updated Mar 2 2026), MICHELIN Guide (May 16 2025), NYT (updated Mar 10 2026), Time Out NY
 * (Dec 16 2025). Crowd/Serious Eats excluded (unverified date). Coords neighborhood-approximate.
 * Generated from workflow w1q02ohvi on 2026-05-29.
 */
import data from "./real-bagels.data.json";
import type { RealRamen } from "./real-ramen";

export const REAL_BAGELS: RealRamen[] = data as RealRamen[];
