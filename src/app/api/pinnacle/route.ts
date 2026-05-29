import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const contenderId = body?.contenderId as string | undefined;
  const action = body?.action as "add" | "remove" | "up" | "down" | undefined;
  if (!contenderId || !["add", "remove", "up", "down"].includes(action ?? "")) {
    return NextResponse.json({ error: "contenderId and a valid action are required." }, { status: 400 });
  }
  const result = getRepo().pinnacleAction(user.id, contenderId, action!);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
