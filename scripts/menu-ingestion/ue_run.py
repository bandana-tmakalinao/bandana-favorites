"""Category-parameterized Uber Eats menu run (ramen / burger) for Bandana Faves.
Runs INSIDE browser-harness (new_tab/js/cdp are pre-imported). Env:
  UE_CAT=ramen|burger   UE_N=<batch size>   UE_IMPORT=0|1   UE_PACE=<seconds between places>
Reads /tmp/ue_<cat>_places.json, writes /tmp/ue_<cat>_results.json (resumable)."""
import json, time, base64, urllib.parse, os, sys, re
sys.path.insert(0, '/tmp')
import ue_cat as U

CAT = os.environ.get('UE_CAT', 'ramen')
cfg = U.CATS[CAT]
SUBSLUG = cfg['subslug']
PLACES = json.load(open(f'/tmp/ue_{CAT}_places.json'))
RES_PATH = f'/tmp/ue_{CAT}_results.json'
results = json.load(open(RES_PATH)) if os.path.exists(RES_PATH) else {}
MAXN = int(os.environ.get('UE_N', '4'))
DO_IMPORT = os.environ.get('UE_IMPORT', '0') == '1'
PACE = float(os.environ.get('UE_PACE', '2.5'))

def mk_pl(addr, lat, lng):
    j = json.dumps({"address": addr, "reference": "", "referenceType": "uber_places", "latitude": lat, "longitude": lng}, separators=(',', ':'))
    return base64.b64encode(urllib.parse.quote(j).encode()).decode()

def decode_uuid(slug):
    try:
        b = base64.urlsafe_b64decode(slug + '==' * ((4 - len(slug) % 4) % 4)); h = b.hex()
        if len(h) != 32: return None
        return f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"
    except Exception: return None

scrape_tid = new_tab("https://www.ubereats.com/feed"); time.sleep(2)
faves_tid = new_tab("https://faves.bandana.com/"); time.sleep(1)
switch_tab(scrape_tid)
print("cat=%s tabs scrape=%s faves=%s import=%s" % (CAT, scrape_tid[:8], faves_tid[:8], DO_IMPORT))

def parse_menu_js(uuid):
    return f"""
(async()=>{{
  try{{
    const r=await fetch('/api/getStoreV1',{{method:'POST',headers:{{'content-type':'application/json','x-csrf-token':'x'}},body:JSON.stringify({{storeUuid:'{uuid}'}})}});
    if(r.status!==200) return JSON.stringify({{err:'status '+r.status}});
    const d=(await r.json()).data;
    const secTitle={{}}; (d.sections||[]).forEach(s=>secTitle[s.uuid]=s.title);
    if(d.subsectionsMap) Object.values(d.subsectionsMap).forEach(s=>{{if(s&&s.uuid&&s.title)secTitle[s.uuid]=s.title;}});
    const out=[]; const seen=new Set();
    Object.values(d.catalogSectionsMap||{{}}).forEach(arr=>(arr||[]).forEach(cs=>{{
      const su=cs.catalogSectionUUID||cs.sectionUuid||cs.subsectionUuid;
      const title=secTitle[su]||(cs.payload&&cs.payload.standardItemsPayload&&cs.payload.standardItemsPayload.title&&cs.payload.standardItemsPayload.title.text)||'(menu)';
      const items=(cs.payload&&cs.payload.standardItemsPayload&&cs.payload.standardItemsPayload.catalogItems)||[];
      items.forEach(it=>{{const t=it.title;if(!t)return;const k=title+'|'+t;if(seen.has(k))return;seen.add(k);out.push({{section:title,name:t,desc:(it.itemDescription||'').slice(0,200)}});}});
    }}));
    return JSON.stringify({{title:d.title,count:out.length,items:out}});
  }}catch(e){{return JSON.stringify({{err:e.message}});}}
}})()
"""

def slug_of(l):
    seg = l['h'].rstrip('/').split('/'); return seg[-2].replace('-', ' ') if len(seg) >= 2 else ''

def scrape_one(p):
    pl = mk_pl(f"{p['name']}, {p['borough']}, NY", p['lat'], p['lng'])
    q = urllib.parse.quote(p['name'])
    js(f"window.location.href='https://www.ubereats.com/search?pl={pl}&q={q}&sc=SEARCH_BAR&searchType=GLOBAL_SEARCH&vertical=ALL'")
    EXL = r'''(()=>{const out=[];const seen=new Set();document.querySelectorAll('a[href*="/store/"]').forEach(a=>{const h=a.getAttribute('href').split('?')[0];const t=a.textContent.trim().slice(0,60);const seg=h.split('/');if(seg.length>=4&&seg[2]!=='apps'&&!seen.has(h)){seen.add(h);out.push({h,t});}});return out.slice(0,20);})()'''
    # Wait for the results grid to actually populate; a transitional page has 0-1 stray links.
    links = []
    time.sleep(3.0)
    for _ in range(8):
        cur = js(EXL) or []
        if len(cur) > len(links): links = cur
        if len(cur) >= 3: break
        time.sleep(1.6)
    if not links: return {"status": "not_found_search", "items": []}
    def cuisine_ok(l):
        return bool(cfg['cuisine'].search((l.get('t') or '') + ' ' + slug_of(l)))
    scored = sorted(({**l, "nm": slug_of(l), "cz": cuisine_ok(l), "s": U.match_score(p['name'], slug_of(l))} for l in links), key=lambda x: -x['s'])
    cands = [c for c in scored if c['s'] >= 0.6 or (c['s'] >= 0.45 and c['cz'])]
    if not cands:
        return {"status": "no_match", "cands": [(l['nm'][:34], round(l['s'], 2), l['cz']) for l in scored[:4]], "items": []}
    best = cands[0]
    slug = best['h'].rstrip('/').rsplit('/', 1)[-1]
    uuid = decode_uuid(slug)
    if not uuid: return {"status": "bad_uuid", "slug": slug, "items": []}
    raw = js(parse_menu_js(uuid))
    try: data = json.loads(raw)
    except Exception: return {"status": "parse_fail", "items": []}
    if data.get('err'): return {"status": "api_" + str(data['err'])[:20], "items": []}
    rows = [{"section": i['section'], "raw": f"{i['name']} | {i['desc']}"} for i in data.get('items', [])]
    items = U.clean_menu(rows, CAT)
    return {"status": "ok" if items else "empty", "store": best['t'][:40], "match": round(best['s'], 2),
            "api_items": data.get('count'), "items": items, "raw_rows": rows, "matched": best['nm'][:40]}

def do_import(p, items):
    payload = {"placeId": p['id'], "placeName": p['name'], "source": "Uber Eats menu (verbatim)",
               "items": [{"subSlug": SUBSLUG, "dish": x['dish'], "description": x['description']} for x in items][:100]}
    expr = ("(async()=>{try{const r=await fetch('/api/admin/import-menu',{method:'POST',headers:{'content-type':'application/json'},"
            "body:JSON.stringify(%s)});const j=await r.json().catch(()=>({}));return JSON.stringify({status:r.status,added:(j.added||[]).length,skipped:(j.skipped||[]).length,error:j.error});}catch(e){return 'ERR '+e.message;}})()" % json.dumps(payload))
    return js(expr, target_id=faves_tid)

todo = [p for p in PLACES if p['id'] not in results][:MAXN]
remaining = len([p for p in PLACES if p['id'] not in results])
print("processing %d (remaining %d)" % (len(todo), remaining))
for p in todo:
    try: r = scrape_one(p)
    except Exception as e: r = {"status": "error", "err": str(e)[:120], "items": []}
    imp = None
    if DO_IMPORT and r.get("items"): imp = do_import(p, r["items"])
    results[p['id']] = {"name": p['name'], "status": r.get('status'), "store": r.get('store'),
                        "match": r.get('match'), "api_items": r.get('api_items'), "cands": r.get('cands'),
                        "items": r.get('items', []), "raw_rows": r.get('raw_rows', []), "import": imp}
    json.dump(results, open(RES_PATH, 'w'), indent=1)
    print(f"  {p['name'][:26]:26} | {str(r.get('status'))[:14]:14} | n={len(r.get('items', [])):2} | {str(r.get('store') or '')[:30]:30} | imp={imp or ''}")
    time.sleep(PACE)

for tid in [scrape_tid, faves_tid]:
    try: cdp("Target.closeTarget", targetId=tid)
    except Exception as e: print("close", e)
print("DONE. total processed:", len(results))
