import { NextRequest, NextResponse } from "next/server";

/**
 * Canonical-host redirect: once faves.bandana.com is live, the Render-provided
 * *.onrender.com host 301s there so Google never indexes (and users never share)
 * the duplicate. No-op until NEXT_PUBLIC_SITE_URL points at the custom domain —
 * safe to deploy ahead of the DNS cutover.
 */
const CANONICAL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (
    CANONICAL.startsWith("https://") &&
    !CANONICAL.includes("onrender.com") &&
    host.endsWith(".onrender.com")
  ) {
    const url = new URL(req.nextUrl.pathname + req.nextUrl.search, CANONICAL);
    return NextResponse.redirect(url, 301);
  }
  return NextResponse.next();
}

// Static assets are host-agnostic; only page/API traffic needs the redirect.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|fonts/|uploads/|logo).*)"],
};
