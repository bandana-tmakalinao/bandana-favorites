#!/usr/bin/env python3
"""
Ingest a NYC place CORPUS for the "add a place you've tried" autocomplete — scoped to ONLY the food
categories we rank (per founder direction), from NYC OpenData (DOHMH restaurant inspections, which
include lat/lng). Deduped to one row per establishment (CAMIS). Writes .data/nyc-corpus.json (gitignored,
regenerable). Each place is tagged with the candidate category slug(s) its cuisine maps to.

    python3 scripts/ingest_corpus.py

This is the corpus people pick from (location-confirmed, dedup-by-design). It does NOT create contenders;
contenders are created only when a user adds/rates a place. (Overture's finer taxonomy can refine the
category tags later; DOHMH is the reliable, coordinate-bearing base.)
"""
import json, os, urllib.parse, urllib.request

# DOHMH cuisine_description -> our category slugs (coarse but scoped to categories we actually rank).
CUISINE_CATS = {
    "Pizza": ["pizza"],
    "Bagels/Pretzels": ["bagel"],
    "Bakery Products/Desserts": ["black-and-white-cookie", "cheesecake", "cannoli"],
    "Donuts": ["black-and-white-cookie"],
    "Jewish/Kosher": ["pastrami"],
    "Delicatessen": ["pastrami", "chopped-cheese", "bacon-egg-cheese"],
    "Sandwiches": ["chopped-cheese", "bacon-egg-cheese", "pastrami"],
    "Sandwiches/Salads/Mixed Buffet": ["chopped-cheese", "bacon-egg-cheese"],
    "Soups/Salads/Sandwiches": ["chopped-cheese", "bacon-egg-cheese"],
    "Japanese": ["ramen"],
    "Chinese": ["soup-dumplings", "dim-sum"],
    "Chinese/Japanese": ["soup-dumplings", "dim-sum", "ramen"],
    "Mexican": ["tacos"],
    "Tex-Mex": ["tacos"],
    "Korean": ["korean-fried-chicken"],
    "Chicken": ["korean-fried-chicken"],
    "Indian": ["dosa"],
    "Bangladeshi": ["dosa"],
    "Pakistani": ["dosa"],
    "Hamburgers": ["cheeseburger"],
    "Steakhouse": ["steak"],
    "Seafood": ["lobster-roll"],
    "Middle Eastern": ["halal-cart"],
    "Mediterranean": ["halal-cart"],
    "Turkish": ["halal-cart"],
    "Frozen Desserts": ["ice-cream"],
    "Southeast Asian": ["pho"],
    "Hotdogs": ["hot-dog"],
    "Hotdogs/Pretzels": ["hot-dog"],
    "Italian": ["cannoli"],
}

BASE = "https://data.cityofnewyork.us/resource/43nn-pn8j.json"


def fetch():
    cuisines = list(CUISINE_CATS.keys())
    in_list = ",".join("'" + c.replace("'", "''") + "'" for c in cuisines)
    fields = "camis,dba,boro,building,street,zipcode,cuisine_description,latitude,longitude"
    params = {
        "$select": fields,
        "$where": f"cuisine_description in ({in_list}) AND latitude IS NOT NULL",
        "$group": fields,
        "$limit": "60000",
    }
    url = BASE + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "BandanaFavorites/0.1 corpus ingest"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def title_case(s):
    return " ".join(w.capitalize() if w.isupper() or w.islower() else w for w in (s or "").split())


def main():
    rows = fetch()
    seen = {}
    for r in rows:
        camis = r.get("camis")
        if not camis or camis in seen:
            continue
        try:
            lat, lng = float(r["latitude"]), float(r["longitude"])
        except (KeyError, ValueError, TypeError):
            continue
        if not (40.45 <= lat <= 40.95 and -74.30 <= lng <= -73.65):
            continue
        cuisine = r.get("cuisine_description", "")
        cats = CUISINE_CATS.get(cuisine, [])
        if not cats:
            continue
        name = title_case(r.get("dba", "").strip())
        if not name:
            continue
        addr = f"{r.get('building','').strip()} {title_case(r.get('street','').strip())}".strip()
        seen[camis] = {
            "id": "corpus_" + camis,
            "name": name,
            "address": (addr + (f", {r.get('boro','')}" if r.get("boro") else "")).strip(", "),
            "borough": r.get("boro", ""),
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "cats": cats,
        }
    corpus = list(seen.values())
    os.makedirs(".data", exist_ok=True)
    json.dump(corpus, open(".data/nyc-corpus.json", "w"), ensure_ascii=False)
    from collections import Counter
    per = Counter(c for p in corpus for c in p["cats"])
    print(f"✓ corpus: {len(corpus)} unique NYC places (scoped to our categories) → .data/nyc-corpus.json")
    for slug, n in sorted(per.items(), key=lambda kv: -kv[1]):
        print(f"  {slug:24} {n}")


if __name__ == "__main__":
    main()
