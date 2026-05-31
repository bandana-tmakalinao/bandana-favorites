# Auth & the trust system

*Signed-cookie sessions with three sign-in paths, plus per-category earned trust that feeds Bradley-Terry vote weight. Last updated 2026-05-31.*

## Status
**Built.** All three sign-in paths work locally with zero env vars: pick-a-name is the default, email+password works in-memory, and Google OAuth is fully wired but **dormant until `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set**. Per-category trust auto-grows and caps on every comparison, and the resulting weight is snapshotted onto each cast. **Honest caveat:** trust-weighting is a *steady-state* Sybil defense, not a day-1 one (see Key decisions). Hard anti-Sybil (phone OTP, full trust ledger, velocity/diversity freezes) is deferred (OVERVIEW §10).

## Where it lives
| File | Role |
| --- | --- |
| `src/lib/auth.ts` | HMAC-signed `bf_session` cookie: `sign`/`verifyToken`, `sessionCookie`/`clearedCookie`, `getCurrentUser()`, `publicUser()` PII-stripper |
| `src/lib/oauth.ts` | Google OAuth 2.0 seam — `googleConfig()`, `isGoogleEnabled()`, `googleAuthUrl()`, `exchangeGoogleCode()`, `OAUTH_STATE_COOKIE` |
| `src/lib/password.ts` | scrypt KDF (`hashPassword`/`verifyPassword`), self-describing `s1$…` format, `TIMING_DUMMY`, `isValidEmail`/`passwordProblem` |
| `src/lib/config.ts` | `TRUST` block — `W_MIN`/`W_MAX`/`GAMMA`, `NORMAL_CAP`/`EXPERT_CAP`, `NEW_USER_TRUST`, `GROWTH_PER_COMPARISON` |
| `src/lib/types.ts` | `User` trust fields `trustScore`/`categoryTrust`/`categoryRoles`; auth fields `email`/`passwordHash`/`oauth` |
| `src/lib/ranking.ts` | `trustToWeight(trustScore)` — the ONE trust→weight curve |
| `src/db/memory.ts` | the trust *engine*: `catTrustCap`, `catTrustFor`, `growCategoryTrust`, `recordDuel`/`recordVote`, `setCategoryRole`, `getCategoryStanding`; user-creation methods |
| `src/db/repo.ts` | `Repo` interface; declares `getCategoryStanding`/`setCategoryRole` + the `CategoryStanding {trust,cap,role,weight}` shape |
| `src/app/api/auth/route.ts` | pick-a-name: `GET` (whoami), `POST` (sign in by name), `DELETE` (sign out) |
| `src/app/api/auth/login/route.ts` · `register/route.ts` | email+password sign-in / sign-up |
| `src/app/api/auth/google/route.ts` · `google/callback/route.ts` | OAuth start + callback |
| `src/app/api/category/role/route.ts` | curator-only `POST` to grant/revoke a per-category `member` role |

## How it works

### Session cookie (the common substrate)
All three paths converge on a signed `bf_session` cookie. Token shape is `uid.issuedAt.sig`, where `sig = HMAC-SHA256(SECRET, "uid.iat")` base64url and `iat` is in base-36 (`auth.ts` `sign`). `verifyToken` constant-time-compares the sig (`timingEq` → `crypto.timingSafeEqual`) and rejects tokens older than `MAX_AGE` (1 year). Legacy 2-part `uid.sig` tokens (no bound expiry) are still accepted once so old sessions survive; the next sign-in re-issues the hardened 3-part format. Cookie is `httpOnly`, `sameSite:lax`, `secure` only in production. `getCurrentUser()` reads the jar, verifies, and hydrates the full `User` via `getRepo().getUser(uid)`.

`SECRET = process.env.SESSION_SECRET || "dev-insecure-secret-change-me"` — if the default is still in place under `NODE_ENV=production`, it `console.warn`s loudly that cookies are **forgeable**.

### Three sign-in paths
1. **Pick-a-name** (`POST /api/auth`, the local default): name ≥ 2 chars → `getRepo().getOrCreateUser(name)` → set session cookie. No password — the "light sign-in" for dev so votes attach to a stable identity. `GET` returns the current `publicUser`; `DELETE` clears the cookie.
2. **Email + password** (`/api/auth/register`, `/api/auth/login`): register validates email (`isValidEmail`), password (`passwordProblem`, ≥ 8 / ≤ 200 chars) and name, then `hashPassword` → `createPasswordUser`. Login does `getUserByEmail` then `verifyPassword`. Hashes use scrypt (`N=2^15, r=8, p=1, keylen=64`), a random 16-byte salt, and an optional HMAC **pepper** (`PASSWORD_PEPPER`) applied *before* the KDF, so a stolen DB dump alone can't be cracked. Format `s1$N$r$p$salt$hash` is self-describing/upgradeable.
3. **Google OAuth** (`/api/auth/google` → `…/callback`): authorization-code flow with a CSRF `state` cookie (`OAUTH_STATE_COOKIE`, 600s TTL). The callback verifies `state` round-trips unchanged, `exchangeGoogleCode` swaps code→token→`/userinfo`, then `findOrCreateOAuthUser({provider:"google", sub, …})` links by the stable Google `sub`. Burns the state cookie, sets the session, redirects to `/me`.

### User shape & PII boundary
`User` (types.ts) carries auth fields `email?`, `passwordHash?` ("never plaintext"), `oauth?: {provider, sub}`. **`publicUser(u)`** is the hard boundary: it returns only `{handle, name, isCurator, trustScore}` — every route that returns a user (e.g. `GET /api/auth`) must funnel through it so `passwordHash`/`email`/`oauth` never cross the wire.

### The trust system → vote weight
The curve and the per-category state live in two places. **`ranking.ts`** owns the one weight curve:

```ts
trustToWeight(t) = W_MIN + (W_MAX − W_MIN) · clamp(t,0,1)^GAMMA   // convex in trust
```

**The repo (`memory.ts`)** owns per-category resolution, capping, and growth (`pg.ts` mirrors it in prod):

```
catTrustCap(user, sub)      // categoryRoles[sub]==="member" ? EXPERT_CAP : NORMAL_CAP
catTrustFor(user, sub)      // min(catTrustCap, categoryTrust[sub] ?? trustScore)  ← effective trust
growCategoryTrust(user,sub) // if current < cap: categoryTrust[sub] = min(cap, current + GROWTH_PER_COMPARISON)
```

On each `recordDuel`/`recordVote`, the repo resolves `catTrustFor` for the contender's food type, snapshots `weight = trustToWeight(catTrust)` onto the `Comparison`/`Vote` row (so re-ranking never re-reads live trust), then calls `growCategoryTrust`. With `W_MIN=0.2`, `W_MAX=3`, `GAMMA=1.5`: a new user starts at `NEW_USER_TRUST=0.1` (weight ≈ 0.29) and gains `GROWTH_PER_COMPARISON=0.01` per comparison **in that category**, reaching the `NORMAL_CAP=0.7` cap (weight ≈ 1.84) in ~60 comparisons. A curator-designated **`member`** for a category has its cap lifted to `EXPERT_CAP=1.0` (full `W_MAX=3` weight) — but only in the vouched category. That snapshot weight is the Bradley-Terry comparison weight `w_u`; see [ranking-engine](./ranking-engine.md) for how `w_u` enters the MM solver and how 0–100 ratings fold in via `THUMB_WEIGHT`. `getCategoryStanding(userId, subSlug)` is the read model the duel UI uses to show `{trust, cap, role, weight}` (the live "trust climbing" meter).

### Roles
`categoryRoles: Record<subSlug, "member">` is written only by `setCategoryRole(curatorId, targetUserId, subSlug, role)`, which **enforces `isCurator` inside the repo** (non-curator → `{ok:false}`). It is exposed via `POST /api/category/role` (also requires a signed-in user; non-curators surface as a 403). There is exactly one role, `member`; it only raises the per-category cap. The cap is applied at *read* time in `catTrustFor`, so revoking a role immediately reduces influence while the stored `categoryTrust` value is preserved (re-promotion restores earned trust).

## Key decisions & why
- **HMAC-signed cookie, not a server session table.** Stateless, dependency-free, fine for the scaffold. Auth.js + OAuth + phone OTP is the named production replacement (OVERVIEW §8).
- **Bound `issuedAt` in the token.** Caps a leaked cookie's lifetime instead of "valid forever"; legacy unbounded tokens are accepted once then re-issued hardened.
- **Per-category trust, not one global score.** Expertise is category-specific — being great at ramen says nothing about pizza — so trust (and the `member` cap lift) is scoped per food type, falling back to the global `trustScore`.
- **`EXPERT_CAP` is curator-assigned, never self-declared** — you can't promote yourself to a heavier vote.
- **Weight is snapshotted at cast time** onto the comparison/vote row, not recomputed from live trust at rank time — so a later trust change can't retroactively rewrite history. The *cap*, however, is applied at read time so role revocation takes effect immediately.
- **scrypt + per-password salt + optional pepper, zero deps.** Defense in depth; the pepper means the app secret (env-only) is required to crack a stolen DB. The self-describing `s1$…` format lets cost rise later with old hashes still verifying.
- **Login/timing hygiene.** `TIMING_DUMMY` is verified against unknown emails so response time can't enumerate accounts; login returns one generic "Invalid email or password."
- **OAuth fully env-gated.** No client id/secret → `googleConfig()` returns `null`, routes redirect with a notice, UI no-ops — dev behavior unchanged. PKCE is flagged as the natural next add.
- **HONEST: trust-weighting is steady-state, not day-1.** At launch every real user *also* has ~0 trust, so the math can't distinguish a real newcomer from a sock-puppet. The actual day-1 defenses are **curator-seeded order**, **provisional gating** (broad/diverse/aged evidence before a rank locks), and **velocity-anomaly freezes**; the trust formula earns its keep later. The hooks exist; enforcement is intentionally light in the scaffold (OVERVIEW §3).
- **Deliberately NOT done:** phone OTP, a full trust ledger, peer photo-verification, email-verification flow (`emailVerified` is a reserved field).

## Gotchas
- **Set `SESSION_SECRET` in production** or cookies are forgeable — it's only a `console.warn`, not a hard fail. Same for `PASSWORD_PEPPER` before the first real sign-up.
- **`getCurrentUser()` is async** (`await cookies()`); it returns `null` for missing/invalid/expired tokens *and* for a valid uid whose user record is gone.
- **Always wrap user objects in `publicUser()`** before returning from a route or passing to a client component, or you leak `passwordHash`/`email`/`oauth`.
- **Trust only grows via `growCategoryTrust`** — for the *one* category a comparison happened in; it never touches the global `trustScore`. A user with no `categoryTrust[sub]` entry votes at their global trust weight (the `?? trustScore` fallback), still cap-clamped. `recordDuel`/`recordVote` require a signed-in user (`"Sign in to vote/rate."`).
- **OAuth `redirectUri` prefers `NEXT_PUBLIC_SITE_URL`** over the request origin; a mismatch vs. the Google console's authorized redirect URI breaks the callback.
- **OAuth `state` cookie TTL is 600s** — a slow consent screen can expire it and trip `oauth_state_error`.
- **All auth routes are `runtime="nodejs"` + `dynamic="force-dynamic"`** — required (scrypt/HMAC need Node crypto; cookies make them dynamic). Don't switch to edge.
- **Rate limits are in-memory** (`@/lib/rate-limit`, keyed by `clientIp`): signin 15, login/register 10, oauth 20 per 10 min — they reset on restart and don't share across instances (matters only once deployed).

## Related
- [ranking-engine](./ranking-engine.md) — the Bradley-Terry weight formula; consumes the snapshotted `w_u` from `trustToWeight`.
- [data-layer](./data-layer.md) — `getRepo()`, `recordDuel`/`recordVote`, and the user-creation methods (`getOrCreateUser`, `createPasswordUser`, `findOrCreateOAuthUser`, `getUserByEmail`).
- [OVERVIEW](../OVERVIEW.md) — §3 (trust honesty note), §8 (auth in the env-gated stack), §10 (deferred hard anti-Sybil).
