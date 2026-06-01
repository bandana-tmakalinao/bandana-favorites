"""Import already-scraped menu results to the live catalog (curator-authed, via a faves.bandana.com tab).
Re-cleans from saved raw_rows with the CURRENT ue_cat filters (so filter tweaks apply retroactively).
Runs INSIDE browser-harness. Env: UE_CAT=ramen|burger  UE_N=<max places to import this call>."""
import json, os, sys, time
sys.path.insert(0, '/tmp')
import ue_cat as U

CAT = os.environ.get('UE_CAT', 'ramen')
cfg = U.CATS[CAT]; SUB = cfg['subslug']
MAXN = int(os.environ.get('UE_N', '100'))
RES = f'/tmp/ue_{CAT}_results.json'
r = json.load(open(RES))

faves = new_tab("https://faves.bandana.com/"); time.sleep(2)

def imp(pid, name, items):
    payload = {"placeId": pid, "placeName": name, "source": "Uber Eats menu (verbatim)",
               "items": [{"subSlug": SUB, "dish": x['dish'], "description": x['description']} for x in items][:100]}
    expr = ("(async()=>{try{const r=await fetch('/api/admin/import-menu',{method:'POST',headers:{'content-type':'application/json'},"
            "body:JSON.stringify(%s)});const j=await r.json().catch(()=>({}));return JSON.stringify({status:r.status,added:(j.added||[]).length,skipped:(j.skipped||[]).length,error:j.error});}catch(e){return 'ERR '+e.message;}})()" % json.dumps(payload))
    return js(expr, target_id=faves)

done = 0
for pid, v in r.items():
    if done >= MAXN: break
    if v.get('import_done'): continue
    items = U.clean_menu(v.get('raw_rows', []), CAT) if v.get('raw_rows') else v.get('items', [])
    if not items: continue
    res = imp(pid, v['name'], items)
    v['import_done'] = res; v['items'] = items
    json.dump(r, open(RES, 'w'), indent=1)
    print(f"  {v['name'][:24]:24} | sent={len(items):2} | {res}")
    done += 1
    time.sleep(1.0)
cdp("Target.closeTarget", targetId=faves)
print("IMPORT DONE", done)
