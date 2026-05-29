import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to suggest a place." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = body?.name as string | undefined;
  const address = body?.address as string | undefined;
  const sub = body?.sub as string | undefined;
  const borough = (body?.borough as string | undefined) ?? "";
  if (!name || !address || !sub) {
    return NextResponse.json({ error: "name, address, and sub are required." }, { status: 400 });
  }

  const result = getRepo().suggestPlace(user.id, { name, address, borough, subSlug: sub });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
