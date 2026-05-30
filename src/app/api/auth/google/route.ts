import { NextResponse } from "next/server";
import { googleConfig, redirectUri, newState, googleAuthUrl, OAUTH_STATE_COOKIE } from "@/lib/oauth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start the Google sign-in flow. No-op (redirect with notice) when OAuth isn't configured. */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const cfg = googleConfig();
  if (!cfg) return NextResponse.redirect(new URL("/me?auth=google_unconfigured", origin));

  const rl = rateLimit(`oauth:${clientIp(req)}`, 20, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.redirect(new URL("/me?auth=rate_limited", origin));

  const state = newState();
  const res = NextResponse.redirect(googleAuthUrl(cfg.clientId, redirectUri(origin), state));
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
