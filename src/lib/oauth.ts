/**
 * Google OAuth 2.0 seam. Entirely env-gated: with no GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET the
 * provider reports disabled and the routes/UI no-op, so dev behavior is unchanged. To activate:
 *
 *   1. Create an OAuth client at https://console.cloud.google.com (type: Web application).
 *   2. Authorized redirect URI: https://<your-domain>/api/auth/google/callback
 *   3. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and NEXT_PUBLIC_SITE_URL (your https origin).
 *
 * Standard authorization-code flow with a CSRF `state` cookie. PKCE is a natural next add.
 */
import crypto from "node:crypto";

export const OAUTH_STATE_COOKIE = "bf_oauth_state";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isGoogleEnabled(): boolean {
  return googleConfig() !== null;
}

/** The callback URL Google redirects back to — derived from the request origin (or NEXT_PUBLIC_SITE_URL). */
export function redirectUri(origin: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || origin;
  return `${base}/api/auth/google/callback`;
}

export function newState(): string {
  return crypto.randomBytes(16).toString("base64url");
}

export function googleAuthUrl(clientId: string, redirect: string, state: string): string {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export interface GoogleProfile {
  sub: string; // stable Google user id
  email?: string;
  name?: string;
  picture?: string;
}

/** Exchange the auth code for tokens, then fetch the user's basic profile. */
export async function exchangeGoogleCode(
  cfg: GoogleConfig,
  code: string,
  redirect: string,
): Promise<GoogleProfile | null> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return null;
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) return null;

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${access_token}` },
  });
  if (!infoRes.ok) return null;
  const info = (await infoRes.json()) as GoogleProfile;
  return info.sub ? info : null;
}
