import { NextRequest } from "next/server";
import { extensionJsonResponse, handleExtensionOptions } from "@/lib/extensionCors";
import { checkSessionRateLimit, clientIp } from "@/lib/rateLimit";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { pushFeedback, listFeedbackRows, type FeedbackRow } from "@/lib/feedbackMemory";

const memoryStore: Array<Record<string, unknown>> = [];
const USER_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

function isValidUserId(userId: string): boolean {
  return USER_ID_RE.test(userId);
}

function sanitizePromptSnippet(snippet: string | undefined): string | undefined {
  if (!snippet) return undefined;
  return snippet.slice(0, 200).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
}

function normalizeFeedbackRows(
  userId: string,
  feedback: unknown[],
  platform: string,
  sessionDate: string
): FeedbackRow[] {
  if (!Array.isArray(feedback)) return [];
  return feedback.map((f) => {
    const row = f as Record<string, unknown>;
    return {
      userId,
      signalType: String(row.signalType || "unknown"),
      taskType: String(row.taskType || "general"),
      verdict: String(row.verdict || "wrong"),
      score: typeof row.score === "number" ? row.score : undefined,
      promptSnippet:
        typeof row.promptSnippet === "string"
          ? sanitizePromptSnippet(row.promptSnippet)
          : undefined,
      platform,
      sessionDate,
    };
  });
}

async function persistFeedbackToSupabase(rows: FeedbackRow[]) {
  const supabase = getSupabase();
  if (!supabase || !rows.length) return;

  await supabase.from("signal_feedback").insert(
    rows.map((row) => ({
      user_id: row.userId,
      session_date: row.sessionDate,
      platform: row.platform,
      signal_type: row.signalType,
      task_type: row.taskType,
      verdict: row.verdict,
      score: row.score ?? null,
      prompt_snippet: row.promptSnippet ?? null,
    }))
  );
}

export async function OPTIONS(request: Request) {
  return handleExtensionOptions(request);
}

export async function POST(req: NextRequest) {
  const limit = checkSessionRateLimit(clientIp(req));
  if (!limit.ok) {
    return extensionJsonResponse(
      req,
      { error: "rate_limited", scope: limit.reason },
      { status: 429, headers: limit.retryAfter ? { "Retry-After": String(limit.retryAfter) } : {} },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return extensionJsonResponse(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const userId = String(body.userId || "");
  if (!userId) {
    return extensionJsonResponse(req, { error: "userId required" }, { status: 400 });
  }
  if (!isValidUserId(userId)) {
    return extensionJsonResponse(req, { error: "invalid userId" }, { status: 400 });
  }

  const sessionDate = String(body.sessionDate || new Date().toISOString().slice(0, 10));
  const platform = String(body.platform || "unknown");

  const sessionRow = {
    user_id: userId,
    session_date: sessionDate,
    platform,
    duration_minutes: Number(body.durationMinutes) || 0,
    message_count: Number(body.messageCount) || 0,
    composite_score: Number(body.compositeScore) || 0,
    human_state: body.humanState || "none",
    depth_moments: Number(body.depthMoments) || 0,
    questions_asked: Number(body.questionsAsked) || 0,
    conscious_delegates: Number(body.consciousDelegates) || 0,
    loop_breaks_taken: Number(body.loopBreaksTaken) || 0,
    interventions_fired: Number(body.interventionsFired) || 0,
    interventions_bypassed: Number(body.interventionsBypassed) || 0,
    reflections_submitted: Number(body.reflectionsSubmitted) || 0,
    lumi_mode: Boolean(body.lumiMode),
    lumi_rituals_completed: Number(body.lumiRitualsCompleted) || 0,
    lumi_homework_suggested: Number(body.lumiHomeworkSuggested) || 0,
    signals: body.signals || {},
    feedback: body.feedback || [],
  };

  const feedbackRows = normalizeFeedbackRows(
    userId,
    sessionRow.feedback as unknown[],
    platform,
    sessionDate
  );
  if (feedbackRows.length) {
    pushFeedback(feedbackRows);
  }

  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    memoryStore.push({ ...sessionRow, storedAt: Date.now() });
    return extensionJsonResponse(req, {
      ok: true,
      mode: "memory",
      count: memoryStore.length,
      feedbackIngested: feedbackRows.length,
    });
  }

  const { data: existingUser } = await supabase.from("users").select("id").eq("id", userId).maybeSingle();

  if (!existingUser) {
    await supabase.from("users").upsert({ id: userId, display_name: "Nomon user" });
  }

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: dupes } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("session_date", sessionRow.session_date)
    .eq("platform", sessionRow.platform)
    .gte("created_at", fiveMinAgo)
    .limit(1);

  if (dupes?.length) {
    if (feedbackRows.length) await persistFeedbackToSupabase(feedbackRows);
    return extensionJsonResponse(req, { ok: true, duplicate: true, feedbackIngested: feedbackRows.length });
  }

  const { error } = await supabase.from("sessions").insert(sessionRow);
  if (error) {
    return extensionJsonResponse(req, { error: error.message }, { status: 500 });
  }

  if (feedbackRows.length) await persistFeedbackToSupabase(feedbackRows);

  return extensionJsonResponse(req, { ok: true, feedbackIngested: feedbackRows.length });
}

export async function GET(request: Request) {
  return extensionJsonResponse(request, {
    ok: true,
    supabase: isSupabaseConfigured(),
    memorySessions: memoryStore.length,
    memoryFeedback: listFeedbackRows().length,
  });
}
