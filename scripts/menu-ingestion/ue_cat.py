"""Category-parameterized menu cleaner for the Bandana Faves menu-ingestion run.

Generalizes the pizza-run cleaner (ue_clean.py) to ramen + cheeseburger. Same shape: a per-category
config of compiled regexes drives is_item(); clean_menu() dedupes + caps. Descriptions are copied
VERBATIM (content integrity). Run `python3 /tmp/ue_cat.py` for the unit tests."""
import re

# Broad stopwords so the *distinctive* token drives store-name matching (not the cuisine word).
GENERIC = {"the","of","co","restaurant","ny","nyc","and","a","an","bar","grill","tavern","house",
  "kitchen","eatery","new","york","brooklyn","manhattan","queens","bronx","staten","island","pizza",
  "pizzeria","ramen","noodle","noodles","burger","burgers","smash","steakhouse","steak","pub","cafe",
  "bistro","room","social","club","prime","rib","japanese","sake","dumpling","by","at"}

def norm(s): return re.sub(r'[^a-z0-9]', '', s.lower())
def store_toks(s): return {t for t in re.findall(r'[a-z]+', s.lower()) if len(t) > 1} - GENERIC
def match_score(target, cand):
    a, b = store_toks(target), store_toks(cand)
    if not a:
        ta, tb = norm(target), norm(cand)
        return 1.0 if len(ta) >= 4 and (ta in tb or tb in ta) else 0.0
    if not b: return 0.0
    return len(a & b) / len(a)

# ---- per-category configs ---------------------------------------------------
def _c(p): return re.compile(p, re.I)

CATS = {
  "ramen": {
    "subslug": "ramen",
    "cuisine": _c(r"ramen|noodle|japanese|asian|tsukemen|izakaya|sushi|\bmen\b"),
    "strong": _c(r"\bramen\b|tsukemen|maze\s?men|abura\s?soba|tantan|tan\s?tan|tonkotsu|\bshoyu\b|\bshio\b|paitan|hakata|\bjiro\b|brothless|dipping\s+noodle|miso\s+ramen|spicy\s+miso|black\s+garlic|\bkuro\b|karaka|tori\s?paitan|chintan|vegetable\s+ramen|veggie\s+ramen|vegan\s+ramen|chicken\s+ramen|classic\s+ramen|original\s+ramen|spicy\s+ramen|garlic\s+ramen"),
    "item_sec": _c(r"\bramen\b|tsukemen|maze\s?men|abura|dipping\s+noodle|signature\s+ramen|\bbroth\b"),
    "nonitem_sec": _c(r"appetizer|starter|\bsides?\b|drink|beverage|dessert|\brice\b|donburi|\bbuns?\b|salad|\bsake\b|\bbeer\b|\bwine\b|topping|extra|kids|sushi|sashimi|\broll|snack|skewer|yakitori|small\s+plate|\bdon\b|cocktail|gyoza"),
    "hard_exclude": _c(r"gyoza|dumpling|\bbun\b|\bbao\b|karaage|edamame|\bsalad\b|donburi|\bdon\b|onigiri|\bsake\b|\bbeer\b|\bwine\b|\bsoda\b|\bsushi\b|sashimi|nigiri|\broll\b|spring\s+roll|fried\s+chicken|\btea\b|\bcoke\b|ramune|\bwater\b|takoyaki|miso\s+soup|seaweed|\brice\b|\bcurry\b|\bskewer|yakitori|yakisoba|\budon\b|(?<!abura\s)\bsoba\b|\bsnack|\bside\b|\bappetizer|\bextra\b|\btopping\b|\bkids?\b|onsen\s+egg|chashu\s+don|pork\s+bun|matcha|\bmochi\b|dessert|highball|\bsoju\b|lemonade|\bjuice\b|cocktail|\bpaste\b|\btopping"),
    "dedup_strip": _c(r"\s+(ramen|noodles?)$"),
    "collapse": [(_c(r"\s*\((regular|large|small|mild|medium|hot|spicy|extra\s+spicy|vegan|v|gf)\)\s*$"), "")],
  },
  "burger": {
    "subslug": "cheeseburger",
    "cuisine": _c(r"burger|smash|american|diner|tavern|grill|steak|\bpub\b|bistro|\bbar\b|comfort|patty|chophouse|cheese"),
    "strong": _c(r"\bburger\b|cheeseburger|smash\s?burger|\bsmash\b|patty\s+melt|hamburger"),
    "item_sec": _c(r"\bburgers?\b|smash"),
    "nonitem_sec": _c(r"\bsides?\b|\bfries\b|drink|beverage|dessert|shake|salad|wings|\bdog|combo|kids|extra|topping|\bsauce|appetizer|starter|\bchicken\b|sandwich|\bsoup\b|cocktail|\bbeer\b|\bwine\b|raw\s+bar|small\s+plate|oyster|\braw\b"),
    "hard_exclude": _c(r"\bfries\b|milk\s?shake|\bshake\b|\bsoda\b|\bsalad\b|\bwings?\b|hot\s?dog|\bdog\b|chicken\s+sandwich|chicken\s+tender|\bnuggets?\b|onion\s+ring|\btots?\b|\bdrink|\bbeer\b|\bwine\b|\bcola\b|lemonade|\bmalt\b|sundae|\bside\b|dipping|\bsauce\s*$|\bextra\b|grilled\s+cheese|\bhoagie\b|\bwrap\b|\bcoke\b|\bwater\b|\btea\b|ice\s+cream|\bfloat\b|\bcookie|brownie|\bchips\b|\bdip\b|\bsoup\b|nachos|quesadilla|caesar|\bslaw\b|dessert|espresso|\blatte\b|cappuccino|\bdonut|\bsplit\b|oyster|\bsteak\b\s*$|\bchili\b\s*$"),
    "dedup_strip": _c(r"^$"),  # never strip "burger" — would collapse everything
    "collapse": [
      (_c(r"\s*\(?\s*(with|w/|incl\.?|includes)\s+fries.*$"), ""),
      (_c(r"\s*[-–]\s*(combo|meal)$"), ""),
      (_c(r"\s+(combo|meal)$"), ""),
    ],
  },
}

def parse_item(raw):
    toks = [t.strip() for t in raw.split("|")]
    keep = []
    for t in toks:
        if not t: continue
        if re.match(r'^#\d+\s+most liked$', t, re.I): continue
        if re.fullmatch(r'\$[\d.,]+', t): continue
        if t == '•': continue
        if re.fullmatch(r'•?\s*\d+%\s*\(\d+\)', t): continue
        if re.fullmatch(r'\$[\d.,]+\s*•?\s*\d+%\s*\(\d+\)', t): continue
        if re.fullmatch(r'\d+%\s*\(\d+\)', t): continue
        if re.fullmatch(r'ordered before', t, re.I): continue
        keep.append(t)
    if not keep: return None, None
    name = keep[0]
    name = re.sub(r'\s*•.*$', '', name)
    name = re.sub(r'\s*\$[\d.,]+.*$', '', name).strip()
    desc = " ".join(keep[1:]).strip()
    desc = re.sub(r'\s*•\s*\d+%\s*\(\d+\)', '', desc).strip()
    return name, desc

def collapse_variant(name, cfg):
    n = name
    for rx, rep in cfg["collapse"]:
        n = rx.sub(rep, n)
    n = re.sub(r'^\d+["”]\s*', '', n)
    return n.strip()

def is_item(section, name, cfg):
    sec = (section or "").lower(); nm = name.lower()
    if cfg["hard_exclude"].search(nm): return False
    strong = bool(cfg["strong"].search(nm))
    if cfg["nonitem_sec"].search(sec) and not strong: return False
    if strong: return True
    if cfg["item_sec"].search(sec): return True
    return False

SKIP_SEC = re.compile(r'picked for you|more to explore|you might|similar|people also|recommended|sponsored|popular.*near|explore', re.I)

def dedup_key(base, cfg):
    k = cfg["dedup_strip"].sub('', base.lower()).strip()
    k = re.sub(r'^the\s+', '', k)
    return norm(k)

def clean_menu(items, cat, cap=30):
    cfg = CATS[cat]
    by = {}; order = []
    for it in items:
        name, desc = parse_item(it.get('raw') or it.get('t') or '')
        if not name or len(name) > 70: continue
        sec = it.get('section') or it.get('sec') or ''
        if SKIP_SEC.search(sec): continue
        if re.match(r'^(choose|build your|create your|pick any|any \d|make your|add |build a)\b', name, re.I): continue
        base = collapse_variant(name, cfg)
        if len(base) < 2: continue
        if not is_item(sec, base, cfg): continue
        k = dedup_key(base, cfg)
        if not k: continue
        is_variant = norm(name) != norm(base)
        if k not in by:
            by[k] = {"dish": base, "description": desc[:200], "variant": is_variant}; order.append(k)
        elif by[k]["variant"] and not is_variant:
            by[k] = {"dish": base, "description": desc[:200], "variant": False}
        elif not by[k]["description"] and desc:
            by[k]["description"] = desc[:200]
    return [{"dish": by[k]["dish"], "description": by[k]["description"]} for k in order][:cap]

if __name__ == "__main__":
    import json
    ramen = [
      {"section": "Ramen", "raw": "Akamaru Modern | $19.00 •  94% (210) | Original tonkotsu broth, pork chashu, scallions."},
      {"section": "Ramen", "raw": "Shiromaru Classic | $18.00 | The original Hakata-style silky tonkotsu."},
      {"section": "Ramen", "raw": "Karaka-Men | $20.00 | Spicy miso tonkotsu with ground pork."},
      {"section": "Ramen", "raw": "Vegetable Ramen | $17.00 | Vegan broth, seasonal vegetables."},
      {"section": "Tsukemen", "raw": "Tsukemen | $21.00 | Thick dipping noodles, rich pork broth on the side."},
      {"section": "Buns", "raw": "Pork Bun | $9.00 | Steamed bun, braised pork belly."},
      {"section": "Sides", "raw": "Edamame | $6.00"},
      {"section": "Sides", "raw": "Gyoza | $8.00 | Pan-fried pork dumplings."},
      {"section": "Rice", "raw": "Chashu Don | $11.00 | Pork over rice."},
      {"section": "Drinks", "raw": "Ramune | $4.00 | Japanese soda."},
    ]
    burger = [
      {"section": "Burgers", "raw": "Cheeseburger | $16.00 •  96% (430) | American cheese, pickle, onion."},
      {"section": "Burgers", "raw": "Hamburger | $14.00"},
      {"section": "Burgers", "raw": "Bacon Cheeseburger | $18.00 | Applewood bacon, cheddar."},
      {"section": "Sandwiches", "raw": "The Minetta Burger | $32.00 | Dry-aged blend, caramelized onions."},
      {"section": "Sandwiches", "raw": "Fried Chicken Sandwich | $17.00 | Buttermilk fried chicken."},
      {"section": "Sandwiches", "raw": "Grilled Cheese | $12.00"},
      {"section": "Sides", "raw": "Cottage Fries | $9.00"},
      {"section": "Sides", "raw": "Onion Rings | $10.00"},
      {"section": "Salads", "raw": "Caesar Salad | $14.00"},
      {"section": "Drinks", "raw": "Coke | $4.00"},
    ]
    print("RAMEN:", json.dumps(clean_menu(ramen, "ramen"), indent=1))
    print("BURGER:", json.dumps(clean_menu(burger, "burger"), indent=1))
    print("match Ippudo:", round(match_score("Ippudo", "Ippudo NY"), 2))
    print("match JG Melon:", round(match_score("J.G. Melon", "J G Melon"), 2))
    print("match wrong:", round(match_score("Peter Luger", "Burger King"), 2))
