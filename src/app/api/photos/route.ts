import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Dev path: store the upload on local disk under public/uploads. Production swaps this for a
 * presigned PUT to Cloudflare R2 when the R2_* env vars are set (see .env.example / DECISIONS.md).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to add a photo." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const contenderId = form?.get("contenderId");
  if (!(file instanceof File) || typeof contenderId !== "string") {
    return NextResponse.json({ error: "file and contenderId are required." }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image must be under 10 MB." }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  const filename = `${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buf);

  const photo = getRepo().addPhoto(user.id, contenderId, `/uploads/${filename}`);
  if (!photo) return NextResponse.json({ error: "Contender not found." }, { status: 404 });
  return NextResponse.json({ photo });
}
