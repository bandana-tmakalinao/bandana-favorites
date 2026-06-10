# SEO cutover runbook — faves.bandana.com

The code side of the SEO overhaul ships with the repo (slug URLs + 301s, ISR, metadata/canonicals,
JSON-LD, editorial blocks, sitemap/robots/manifest/404, host-redirect middleware). This file is the
**manual half**: domain, env, OAuth, and Search Console. Steps are ordered; nothing here is code.

## 1. Add the custom domain on Render

Dashboard → service **bandana-favorites** → Settings → **Custom Domains** → Add `faves.bandana.com`.
Render shows the DNS target (CNAME to `bandana-favorites.onrender.com`) and starts cert issuance
once DNS resolves.

## 2. DNS

At bandana.com's DNS provider: add **CNAME `faves` → `bandana-favorites.onrender.com`**, TTL 300.

- If the zone is on Cloudflare: create the record **DNS-only (grey cloud)** until Render shows
  "Certificate issued". If you proxy it afterwards, set SSL mode **Full (strict)**.
- Verify: `https://faves.bandana.com` loads the app with a valid cert, no redirect loop.

## 3. Flip the env var (this is what activates everything)

Render → bandana-favorites → Environment → set

```
NEXT_PUBLIC_SITE_URL=https://faves.bandana.com
```

Saving triggers a rebuild + deploy — **required, not optional**: the value is build-time inlined and
drives `metadataBase` (canonicals + OG image URLs), JSON-LD URLs, sitemap URLs, the OAuth redirect
base, and arms the host-redirect middleware (onrender.com → 301 faves.bandana.com). The middleware
is a no-op until this var points at the custom domain, so deploying code ahead of DNS is safe.

## 4. Google OAuth

Google Cloud Console → the OAuth client used for sign-in → **Authorized redirect URIs** → add
`https://faves.bandana.com/api/auth/google/callback`. Keep the onrender URI during transition.
(Sessions are cookie-host-scoped — anyone signed in on the onrender host signs in once more.)

## 5. Search Console

1. Create a property. Best: **Domain property for `bandana.com`** (one DNS TXT record, covers all
   subdomains). Alternative: URL-prefix property `https://faves.bandana.com`.
2. Sitemaps → submit `https://faves.bandana.com/sitemap.xml`.
3. URL Inspection → **Request indexing** for: `/`, `/nyc`, `/explore`, and the top category pages
   (`/nyc/pizza`, `/nyc/ramen`, `/nyc/bagel`, `/nyc/cheeseburger`, `/nyc/tacos`).
4. Over the following weeks, watch Coverage: the legacy `/c/<id>` URLs should drain into
   "Page with redirect"; category + dish pages should accumulate under Indexed.

## 6. Leave in place permanently

- The onrender→faves 301 middleware.
- The `/c/[id]` → slug-URL 301 route (old share posters and links live forever).

## Spot-checks after the cutover deploy

```bash
curl -sI https://bandana-favorites.onrender.com/nyc/pizza | grep -iE "location|HTTP"   # 301 → faves
curl -s https://faves.bandana.com/nyc/pizza | grep -o '<link rel="canonical"[^>]*>'     # faves canonical
curl -s https://faves.bandana.com/robots.txt                                           # sitemap line
curl -s https://faves.bandana.com/sitemap.xml | head -20                                # absolute faves URLs
curl -sI "https://faves.bandana.com/c/<any-old-id>" | grep -i location                  # 301 → slug URL
```

Then paste `https://faves.bandana.com/nyc/pizza` into Google's **Rich Results Test** — expect
ItemList + BreadcrumbList + FAQPage detected.
