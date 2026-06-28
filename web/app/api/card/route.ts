import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getLearnedMoment } from "@/lib/lumiMemory";
import { aggregateSessions, pickInsight } from "@/lib/scoring";
import { classifyShape } from "@/lib/shapes";
import { getUserById } from "@/lib/auth";

function weekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const week = req.nextUrl.searchParams.get("week") || weekStart();

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    const learnedMoment = getLearnedMoment(userId, week)?.text || null;
    return NextResponse.json({
      userId,
      weekStart: week,
      shape: "Balanced",
      insightLine: "Connect Supabase to load real card data.",
      learnedMoment,
      lumiMode: Boolean(learnedMoment),
      demo: true,
    });
  }

  const user = await getUserById(userId);
  if (!user?.pro) {
    return NextResponse.json({ error: "Pro required" }, { status: 403 });
  }

  const weekEnd = new Date(week);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .gte("session_date", week)
    .lt("session_date", weekEndStr);

  const metrics = aggregateSessions(sessions || []);
  const shape = classifyShape(metrics);

  const prevStart = new Date(week);
  prevStart.setUTCDate(prevStart.getUTCDate() - 7);
  const prevWeek = prevStart.toISOString().slice(0, 10);
  const prevEnd = week;

  const { data: prevSessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .gte("session_date", prevWeek)
    .lt("session_date", prevEnd);

  const lastMetrics = aggregateSessions(prevSessions || []);
  const insightLine = pickInsight(metrics, lastMetrics);
  const learnedMoment = getLearnedMoment(userId, week)?.text || null;

  return NextResponse.json({
    userId,
    weekStart: week,
    shape,
    insightLine,
    learnedMoment,
    lumiMode: Boolean(learnedMoment),
    ...metrics,
    session_count: sessions?.length || 0,
    questionCommandRatio:
      metrics.total_messages > 0
        ? metrics.questions_asked / Math.max(metrics.total_messages - metrics.questions_asked, 1)
        : 0,
  });
}
