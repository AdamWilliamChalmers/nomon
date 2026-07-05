import { NextRequest, NextResponse } from "next/server";
import { confirmConsent } from "@/lib/familyMemory";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = String(body.token || "");
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const row = confirmConsent(token);
  if (!row) {
    return NextResponse.json({ error: "Invalid or expired consent link" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    childUserId: row.childUserId,
    childEmail: row.childEmail,
    accountStatus: "active",
    message: "Account activated. Your child can now use Nomon.",
  });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    token,
    preview: true,
    collects:
      "Behavioural signals only (prompt length, velocity). No message content. No conversation logs.",
    doesNotCollect: "Prompts, AI responses, session-by-session surveillance data",
  });
}
