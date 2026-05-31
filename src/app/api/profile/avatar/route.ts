import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRepo } from "@/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Avatars are stored inline as a small JPEG data URL on the user record. The client resizes to
// 256×256 before upload, so the payload is tiny and persists in the DB — no disk writes (ephemeral
// on Render) and no object storage needed. Cap defends against oversized / non-image payloads.
const MAX_LEN = 400_000; // ~300KB image after base64 overhead
const DATA_URL_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to set a photo." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const dataUrl: unknown = body?.dataUrl;

  if (typeof dataUrl !== "string" || !DATA_URL_RE.test(dataUrl)) {
    return NextResponse.json({ ok: false, error: "That doesn't look like an image." }, { status: 400 });
  }
  if (dataUrl.length > MAX_LEN) {
    return NextResponse.json({ ok: false, error: "Image is too large." }, { status: 413 });
  }

  const result = getRepo().setAvatar(user.id, dataUrl);
  return NextResponse.json({ ...result, url: dataUrl });
}
