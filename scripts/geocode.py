#!/usr/bin/env python3
"""
Geocode the real seed lists' street addresses to exact lat/lng via the free US Census geocoder
(no API key). Validates results fall within the NYC bbox; falls back to the existing
neighborhood-approximate coordinate for anything it can't confidently match. Idempotent: entries
already marked "geocoded": true are skipped on re-run.

    python3 scripts/geocode.py

Re-seed afterward (npm run seed) to push the new coordinates into the store.
"""
import json, os, sys, time, urllib.parse, urllib.request

FILES = [
    "src/seed/real-ramen.data.json",
    "src/seed/real-pizza.data.json",
    "src/seed/real-bagels.data.json",
    "src/seed/real-ice-cream.data.json",
    "src/seed/real-steak.data.json",
]
BENCH = "Public_AR_Current"
NYC = dict(s=40.45, n=40.95, w=-74.30, e=-73.65)
UA = {"User-Agent": "BandanaFavorites/0.1 (NYC food ranking seed; geocode script)"}


def census(address):
    q = urllib.parse.urlencode({"address": address, "benchmark": BENCH, "format": "json"})
    url = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?" + q
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.load(r)
    m = data.get("result", {}).get("addressMatches", [])
    if not m:
        return None
    c = m[0]["coordinates"]
    return float(c["y"]), float(c["x"])  # lat, lng


def in_nyc(lat, lng):
    return NYC["s"] <= lat <= NYC["n"] and NYC["w"] <= lng <= NYC["e"]


def has_street(addr):
    # crude: a real street address starts with a number and isn't the "<neighborhood>, NYC" fallback
    return bool(addr) and not addr.strip().endswith(", NYC") and any(ch.isdigit() for ch in addr.split(",")[0])


def main():
    total_ok = total_skip = total_fail = 0
    for path in FILES:
        if not os.path.exists(path):
            print(f"  (skip, missing) {path}")
            continue
        shops = json.load(open(path))
        ok = skip = fail = 0
        for s in shops:
            if s.get("geocoded"):
                skip += 1
                continue
            addr = s.get("address", "")
            if not has_street(addr):
                fail += 1
                continue
            try:
                res = census(addr)
            except Exception:
                res = None
            if res and in_nyc(*res):
                s["lat"], s["lng"] = round(res[0], 6), round(res[1], 6)
                s["geocoded"] = True
                ok += 1
            else:
                fail += 1
            time.sleep(0.2)
        json.dump(shops, open(path, "w"), indent=2, ensure_ascii=False)
        print(f"  {os.path.basename(path)}: geocoded {ok}, kept-approx {fail}, already {skip} (of {len(shops)})")
        total_ok += ok; total_skip += skip; total_fail += fail
    print(f"DONE: exact {total_ok}, approx {total_fail}, cached {total_skip}")


if __name__ == "__main__":
    main()
