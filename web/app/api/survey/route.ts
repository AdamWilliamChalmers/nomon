import { NextRequest, NextResponse } from "next/server";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getSurveyAggregate, listSurveyResponses, pushSurveyResponse } from "@/lib/surveyMemory";

function clampLikert(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(7, Math.round(n)));
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = String(body.userId || "anonymous");
  const q1 = clampLikert(body.q1);
  const q2 = clampLikert(body.q2);
  const q3 = clampLikert(body.q3);
  const q4 = clampLikert(body.q4);
  const q5 = clampLikert(body.q5);

  if ([q1, q2, q3, q4, q5].some((v) => v == null)) {
    return NextResponse.json({ error: "All five items required (1–7)" }, { status: 400 });
  }

  const row = {
    userId,
    sessionDate: String(body.sessionDate || new Date().toISOString().slice(0, 10)),
    platform: String(body.platform || "unknown"),
    compositeScore: typeof body.compositeScore === "number" ? body.compositeScore : undefined,
    q1: q1!,
    q2: q2!,
    q3: q3!,
    q4: q4!,
    q5: q5!,
    createdAt: Date.now(),
  };

  pushSurveyResponse(row);

  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    await supabase.from("survey_responses").insert({
      user_id: row.userId,
      session_date: row.sessionDate,
      platform: row.platform,
      composite_score: row.compositeScore ?? null,
      q1: row.q1,
      q2: row.q2,
      q3: row.q3,
      q4: row.q4,
      q5: row.q5,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const supabase = getSupabase();
  let rows = listSurveyResponses();

  if (supabase && isSupabaseConfigured()) {
    const { data } = await supabase
      .from("survey_responses")
      .select("user_id, session_date, platform, composite_score, q1, q2, q3, q4, q5, created_at");
    if (data?.length) {
      rows = [
        ...rows,
        ...data.map((r) => ({
          userId: r.user_id,
          sessionDate: r.session_date,
          platform: r.platform,
          compositeScore: r.composite_score ?? undefined,
          q1: r.q1,
          q2: r.q2,
          q3: r.q3,
          q4: r.q4,
          q5: r.q5,
          createdAt: new Date(r.created_at).getTime(),
        })),
      ];
    }
  }

  return NextResponse.json({
    ok: true,
    aggregate: getSurveyAggregate(),
    responses: rows,
  });
}
