import { NextResponse } from "next/server";
import { deriveCrowdCalibration } from "@/lib/calibrationWeights";
import { aggregateFeedbackRows, listFeedbackRows, type FeedbackRow } from "@/lib/feedbackMemory";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

async function loadAllFeedbackRows(): Promise<FeedbackRow[]> {
  const rows = listFeedbackRows();
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) return rows;

  const { data } = await supabase
    .from("signal_feedback")
    .select("user_id, session_date, platform, signal_type, task_type, verdict, score, prompt_snippet");

  if (!data?.length) return rows;

  const fromDb: FeedbackRow[] = data.map((row) => ({
    userId: row.user_id,
    sessionDate: row.session_date,
    platform: row.platform,
    signalType: row.signal_type,
    taskType: row.task_type,
    verdict: row.verdict,
    score: row.score ?? undefined,
    promptSnippet: row.prompt_snippet ?? undefined,
  }));

  return [...rows, ...fromDb];
}

export async function GET() {
  const rows = await loadAllFeedbackRows();
  const aggregate = aggregateFeedbackRows(rows);
  const calibration = deriveCrowdCalibration(rows);

  return NextResponse.json({
    ok: true,
    source: isSupabaseConfigured() ? "memory+supabase" : "memory",
    ...aggregate,
    totalSamples: rows.length,
    calibration,
  });
}
