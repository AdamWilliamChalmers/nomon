import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabase } from "@/lib/supabase";
import { aggregateSessions, pickInsight } from "@/lib/scoring";
import { classifyShape } from "@/lib/shapes";

const REFLECTION_QUESTIONS = [
  "What did you figure out yourself this week, without AI?",
  "Was there a moment where you surprised yourself?",
  "What would you do differently if AI disappeared tomorrow?",
];

function weekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, mode: "noop", reason: "Supabase not configured" });
  }

  const start = weekStart();
  const weekEnd = new Date(start);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const { data: users } = await supabase.from("users").select("id, email, display_name").not("email", "is", null);

  const resendKey = process.env.RESEND_API_KEY;
  const resend = resendKey ? new Resend(resendKey) : null;
  let sent = 0;

  for (const user of users || []) {
    const { data: sessions } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user.id)
      .gte("session_date", start)
      .lt("session_date", weekEnd.toISOString().slice(0, 10));

    if (!sessions?.length) continue;

    const metrics = aggregateSessions(sessions);
    const shape = classifyShape(metrics);
    const insightLine = pickInsight(metrics);

    await supabase.from("weekly_summaries").upsert({
      user_id: user.id,
      week_start: start,
      shape,
      intentional_pct: metrics.intentional_pct,
      questions_asked: metrics.questions_asked,
      depth_moments: metrics.depth_moments,
      conscious_delegates: metrics.conscious_delegates,
      loop_breaks_taken: sessions.reduce((a, s) => a + (s.loop_breaks_taken || 0), 0),
      session_count: sessions.length,
      total_messages: metrics.total_messages,
      insight_line: insightLine,
    });

    if (resend && user.email) {
      const q = REFLECTION_QUESTIONS[new Date().getMonth() % REFLECTION_QUESTIONS.length];
      await resend.emails.send({
        from: "Lumen <hello@lumen.so>",
        to: user.email,
        subject: `Your Lumen week — ${shape}`,
        html: `<p>${insightLine}</p><p><strong>Reflection:</strong> ${q}</p>`,
      });
      sent += 1;
    }
  }

  return NextResponse.json({ ok: true, sent });
}

// Vercel Cron invokes scheduled jobs with a GET request and automatically
// attaches `Authorization: Bearer ${CRON_SECRET}`. Reuse the same handler so
// the weekly digest runs both on schedule (GET) and on manual trigger (POST).
export const GET = POST;
