import { getLearnedMoment, setLearnedMoment, weekStart } from "@/lib/lumiMemory";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const week = req.nextUrl.searchParams.get("week") || weekStart();

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const moment = getLearnedMoment(userId, week);
  return NextResponse.json({ userId, weekStart: week, learnedMoment: moment?.text || null });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = String(body.userId || "");
  const text = String(body.text || "").trim();
  const week = String(body.weekStart || weekStart());

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (!text || text.length > 500) {
    return NextResponse.json({ error: "text required (max 500 chars)" }, { status: 400 });
  }

  const entry = setLearnedMoment(userId, text, week);
  return NextResponse.json({ ok: true, ...entry });
}
