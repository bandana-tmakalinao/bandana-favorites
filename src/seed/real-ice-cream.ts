/**
 * Real NYC ice cream seed — consensus from 2025+ best-of lists (same approach as ramen/pizza).
 * SOURCE DATES VERIFIED 2026-05-29 (2025+ only): The Infatuation (May 1 2026), Eater NY
 * (May 6 2026), Time Out NY (Jun 23 2025). MICHELIN desserts had no ice-cream-specific shops and
 * NYT had no ice-cream guide (both excluded); crowd excluded (unverified). Coords approximate.
 * Generated from workflow w1q02ohvi on 2026-05-29.
 */
import data from "./real-ice-cream.data.json";
import type { RealRamen } from "./real-ramen";

export const REAL_ICE_CREAM: RealRamen[] = data as RealRamen[];
