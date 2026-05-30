#!/usr/bin/env python3
"""
Apply the seed-expansion workflow's output to the curated seed.

Input: a JSON file shaped like the workflow's return — {"categories": [{"slug", "entries":[...]}, ...]}
For each category, merges its researched entries into src/seed/real-<slug>.data.json (dedupe + geocode
via seed_merge), then prints a per-category and total before→after report.

Usage:  python3 scripts/apply_expansion.py <results.json>
Then:   npm run seed   (regenerate .data/store.json)
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from seed_merge import merge, SEED_DIR  # noqa: E402


def _count(slug):
    path = os.path.join(SEED_DIR, f"real-{slug}.data.json")
    return len(json.load(open(path))) if os.path.exists(path) else 0


def main(results_path):
    data = json.load(open(results_path))
    cats = data.get("categories", data if isinstance(data, list) else [])
    rows, total_added = [], 0
    for c in cats:
        slug = c.get("slug")
        entries = c.get("entries", []) or []
        if not slug:
            continue
        before = _count(slug)
        added, total = merge(slug, entries)
        total_added += added
        rows.append((slug, before, total, added, len(entries)))

    rows.sort(key=lambda r: -r[3])
    print(f"\n{'category':<26}{'before':>7}{'after':>7}{'added':>7}{'researched':>12}")
    print("-" * 69)
    for slug, before, after, added, researched in rows:
        print(f"{slug:<26}{before:>7}{after:>7}{added:>7}{researched:>12}")
    grand = sum(_count(s) for s in [r[0] for r in rows])
    print("-" * 69)
    print(f"{'TOTAL across ' + str(len(rows)) + ' categories':<26}{'':>7}{'':>7}{total_added:>7}")
    print(f"\nNet new contenders: +{total_added}. Now run: npm run seed")


if __name__ == "__main__":
    main(sys.argv[1])
