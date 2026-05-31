import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";
import { isModerator } from "@/lib/moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireModerator() {
  const user = await getCurrentUser();
  if (!user) return { error: "auth" as const, status: 401 };
  if (!isModerator(user)) return { error: "forbidden" as const, status: 403 };
  return { user };
}

export async function GET() {
  const gate = await requireModerator();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  return NextResponse.json({ proposed: getRepo().listProposed() });
}

export async function POST(req: Request) {
  const gate = await requireModerator();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => null);
  const contenderId = body?.contenderId as string | undefined;
  const approve = !!body?.approve;
  if (!contenderId) return NextResponse.json({ error: "contenderId required." }, { status: 400 });
  const result = getRepo().reviewProposed(contenderId, approve);
  return NextResponse.json(result);
}
