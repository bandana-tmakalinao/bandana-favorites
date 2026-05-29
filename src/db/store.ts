import fs from "node:fs";
import path from "node:path";
import type { StoreData } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const CORPUS_PATH = path.join(DATA_DIR, "nyc-corpus.json");

/** A NYC place from the scoped corpus (NYC OpenData), used for the add-a-place autocomplete. */
export interface CorpusPlace {
  id: string;
  name: string;
  address: string;
  borough: string;
  lat: number;
  lng: number;
  cats: string[]; // candidate category slugs (coarse, from cuisine)
}

export function loadCorpus(): CorpusPlace[] {
  try {
    return JSON.parse(fs.readFileSync(CORPUS_PATH, "utf8")) as CorpusPlace[];
  } catch {
    return [];
  }
}

export function loadStore(): StoreData | null {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    return JSON.parse(raw) as StoreData;
  } catch {
    return null;
  }
}

export function saveStore(store: StoreData): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store));
}

export { STORE_PATH };
