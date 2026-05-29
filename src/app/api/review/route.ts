import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In production this is gated on user.isCurator; in the scaffold any signed-in user can review.
async function requireReviewer() {
  const user = await getCurrentUser();
  return user;
}

export async function GET() {
  if (!(await requireReviewer())) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  return NextResponse.json({ proposed: getRepo().listProposed() });
}

export async function POST(req: Request) {
  if (!(await requireReviewer())) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const contenderId = body?.contenderId as string | undefined;
  const approve = !!body?.approve;
  if (!contenderId) return NextResponse.json({ error: "contenderId required." }, { status: 400 });
  const result = getRepo().reviewProposed(contenderId, approve);
  return NextResponse.json(result);
}
