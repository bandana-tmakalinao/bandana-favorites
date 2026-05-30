import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { googleConfig, redirectUri, exchangeGoogleCode, OAUTH_STATE_COOKIE } from "@/lib/oauth";
import { getRepo } from "@/db/repo";
import { sessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Google redirects here with ?code&state. Verify CSRF state, exchange, link/create user, sign in. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const cfg = googleConfig();
  if (!cfg) return NextResponse.redirect(new URL("/me?auth=google_unconfigured", origin));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const cookieState = jar.get(OAUTH_STATE_COOKIE)?.value;
  // CSRF: the state we set must round-trip back unchanged.
  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/me?auth=oauth_state_error", origin));
  }

  const profile = await exchangeGoogleCode(cfg, code, redirectUri(origin));
  if (!profile) return NextResponse.redirect(new URL("/me?auth=oauth_failed", origin));

  const user = getRepo().findOrCreateOAuthUser({
    provider: "google",
    sub: profile.sub,
    name: profile.name,
    email: profile.email,
    avatarUrl: profile.picture,
  });

  const res = NextResponse.redirect(new URL("/me", origin));
  const c = sessionCookie(user.id);
  res.cookies.set(c.name, c.value, c);
  res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 }); // burn the state
  return res;
}
