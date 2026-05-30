#!/usr/bin/env python3
"""
Merge consensus-researched dishes into the curated seed (src/seed/real-<slug>.data.json).

- Dedupes by normalized place name (won't duplicate an existing contender).
- Geocodes by NYC neighborhood centroid (approximate; geocoded:false) with a deterministic
  per-name jitter so co-located pins don't stack. Real coords refine later via the Census pass.
- Ranking is driven by seedQuality (seed duels), NOT file order, so we simply append.

Reused by the seed-expansion workflow: each category's researched entries are fed through merge().

Usage:
    from seed_merge import merge
    added, total = merge("tacos", [ {name, neighborhood, borough, title, description,
                                     signatureDish, appearsOn, appearanceCount, seedQuality}, ... ])
"""
import json
import os
import re
import hashlib

SEED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "seed")

# NYC neighborhood centroids (superset of placeholder.ts NEIGHBORHOODS). Approximate.
HOODS = {
    # Manhattan
    "east village": ("Manhattan", 40.7265, -73.9815),
    "west village": ("Manhattan", 40.7358, -74.0036),
    "greenwich village": ("Manhattan", 40.7336, -74.0027),
    "lower east side": ("Manhattan", 40.7150, -73.9843),
    "chinatown": ("Manhattan", 40.7158, -73.9970),
    "nolita": ("Manhattan", 40.7226, -73.9966),
    "soho": ("Manhattan", 40.7233, -74.0030),
    "tribeca": ("Manhattan", 40.7195, -74.0089),
    "financial district": ("Manhattan", 40.7075, -74.0113),
    "koreatown": ("Manhattan", 40.7478, -73.9866),
    "flatiron": ("Manhattan", 40.7401, -73.9903),
    "gramercy": ("Manhattan", 40.7368, -73.9845),
    "chelsea": ("Manhattan", 40.7465, -74.0014),
    "midtown": ("Manhattan", 40.7549, -73.9840),
    "midtown west": ("Manhattan", 40.7600, -73.9900),
    "hell's kitchen": ("Manhattan", 40.7638, -73.9918),
    "murray hill": ("Manhattan", 40.7479, -73.9756),
    "upper east side": ("Manhattan", 40.7736, -73.9566),
    "upper west side": ("Manhattan", 40.7870, -73.9754),
    "harlem": ("Manhattan", 40.8116, -73.9465),
    "east harlem": ("Manhattan", 40.7957, -73.9389),
    "washington heights": ("Manhattan", 40.8417, -73.9393),
    "two bridges": ("Manhattan", 40.7117, -73.9912),
    "bowery": ("Manhattan", 40.7235, -73.9925),
    # Brooklyn
    "williamsburg": ("Brooklyn", 40.7081, -73.9571),
    "greenpoint": ("Brooklyn", 40.7304, -73.9512),
    "bushwick": ("Brooklyn", 40.6944, -73.9213),
    "park slope": ("Brooklyn", 40.6721, -73.9777),
    "sunset park": ("Brooklyn", 40.6453, -74.0125),
    "greenwood heights": ("Brooklyn", 40.6580, -73.9959),
    "carroll gardens": ("Brooklyn", 40.6795, -73.9990),
    "cobble hill": ("Brooklyn", 40.6862, -73.9959),
    "fort greene": ("Brooklyn", 40.6896, -73.9742),
    "crown heights": ("Brooklyn", 40.6681, -73.9442),
    "bedford-stuyvesant": ("Brooklyn", 40.6872, -73.9418),
    "bed-stuy": ("Brooklyn", 40.6872, -73.9418),
    "prospect heights": ("Brooklyn", 40.6776, -73.9686),
    "downtown brooklyn": ("Brooklyn", 40.6909, -73.9841),
    "dumbo": ("Brooklyn", 40.7033, -73.9881),
    "red hook": ("Brooklyn", 40.6751, -74.0099),
    "sheepshead bay": ("Brooklyn", 40.5862, -73.9442),
    "brighton beach": ("Brooklyn", 40.5776, -73.9614),
    "bay ridge": ("Brooklyn", 40.6264, -74.0299),
    # Queens
    "astoria": ("Queens", 40.7644, -73.9235),
    "long island city": ("Queens", 40.7447, -73.9485),
    "jackson heights": ("Queens", 40.7557, -73.8831),
    "flushing": ("Queens", 40.7596, -73.8300),
    "elmhurst": ("Queens", 40.7370, -73.8800),
    "corona": ("Queens", 40.7449, -73.8626),
    "woodside": ("Queens", 40.7454, -73.9050),
    "sunnyside": ("Queens", 40.7434, -73.9196),
    "forest hills": ("Queens", 40.7185, -73.8448),
    "murray hill (queens)": ("Queens", 40.7640, -73.8120),
    "rockaway beach": ("Queens", 40.5795, -73.8366),
    "rockaways": ("Queens", 40.5795, -73.8366),
    "ridgewood": ("Queens", 40.7005, -73.9060),
    # Bronx
    "arthur avenue": ("Bronx", 40.8540, -73.8880),
    "belmont": ("Bronx", 40.8540, -73.8880),
    "fordham": ("Bronx", 40.8610, -73.8900),
    "mott haven": ("Bronx", 40.8090, -73.9229),
    "concourse": ("Bronx", 40.8300, -73.9220),
    # Staten Island
    "st. george": ("Staten Island", 40.6437, -74.0765),
    "stapleton": ("Staten Island", 40.6270, -74.0760),
}

BOROUGH_CENTER = {
    "Manhattan": (40.7831, -73.9712),
    "Brooklyn": (40.6782, -73.9442),
    "Queens": (40.7282, -73.7949),
    "Bronx": (40.8448, -73.8648),
    "Staten Island": (40.5795, -74.1502),
}


def _norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _coords(neighborhood, borough, key):
    """Resolve to a neighborhood centroid (or borough center) + a deterministic small jitter."""
    hood = HOODS.get((neighborhood or "").strip().lower())
    if hood:
        _b, lat, lng = hood
    else:
        lat, lng = BOROUGH_CENTER.get(borough, BOROUGH_CENTER["Manhattan"])
    seed = int(hashlib.md5(key.encode("utf-8")).hexdigest(), 16)
    off_lat = ((seed % 1000) / 1000.0 - 0.5) * 0.012
    off_lng = (((seed // 1000) % 1000) / 1000.0 - 0.5) * 0.012
    return round(lat + off_lat, 6), round(lng + off_lng, 6)


def merge(slug, new_entries):
    """Append net-new (deduped, geocoded) entries to real-<slug>.data.json. Returns (added, total)."""
    path = os.path.join(SEED_DIR, f"real-{slug}.data.json")
    existing = json.load(open(path)) if os.path.exists(path) else []
    have = {_norm(e["name"]) for e in existing}
    added = 0
    for e in new_entries:
        nm = _norm(e.get("name", ""))
        if not nm or nm in have:
            continue
        lat, lng = _coords(e.get("neighborhood"), e.get("borough"), e["name"] + slug)
        appears = e.get("appearsOn", []) or []
        existing.append({
            "name": e["name"],
            "neighborhood": e.get("neighborhood", ""),
            "borough": e.get("borough", ""),
            "address": e.get("address", ""),
            "lat": lat,
            "lng": lng,
            "signatureBowl": e.get("signatureDish") or e.get("signatureBowl") or e.get("title") or "",
            "appearsOn": appears,
            "appearanceCount": e.get("appearanceCount", len(appears)),
            "seedQuality": round(float(e.get("seedQuality", 0.6)), 2),
            "geocoded": False,
            "title": e.get("title") or e.get("signatureDish") or "",
            "description": e.get("description", ""),
        })
        have.add(nm)
        added += 1
    json.dump(existing, open(path, "w"), indent=1, ensure_ascii=False)
    return added, len(existing)


if __name__ == "__main__":
    import sys
    # CLI: seed_merge.py <slug> <entries.json>
    slug, entries_path = sys.argv[1], sys.argv[2]
    entries = json.load(open(entries_path))
    a, t = merge(slug, entries)
    print(f"{slug}: +{a} (total {t})")
