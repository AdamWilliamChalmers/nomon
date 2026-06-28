import { deriveCrowdCalibration } from "@/lib/calibrationWeights";
import { extensionJsonResponse, handleExtensionOptions } from "@/lib/extensionCors";
import { listFeedbackRows } from "@/lib/feedbackMemory";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { FeedbackRow } from "@/lib/feedbackMemory";

async function loadAllFeedbackRows(): Promise<FeedbackRow[]> {
  const rows = listFeedbackRows();
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) return rows;

  const { data } = await supabase
    .from("signal_feedback")
    .select("user_id, session_date, platform, signal_type, task_type, verdict, score");

  if (!data?.length) return rows;

  return [
    ...rows,
    ...data.map((row) => ({
      userId: row.user_id,
      sessionDate: row.session_date,
      platform: row.platform,
      signalType: row.signal_type,
      taskType: row.task_type,
      verdict: row.verdict,
      score: row.score ?? undefined,
    })),
  ];
}

export async function OPTIONS(request: Request) {
  return handleExtensionOptions(request);
}

/** Crowd-derived weights for the extension scoring engine */
export async function GET(request: Request) {
  const rows = await loadAllFeedbackRows();
  const calibration = deriveCrowdCalibration(rows);

  return extensionJsonResponse(request, {
    ok: true,
    ...calibration,
    sampleCount: rows.length,
  });
}
