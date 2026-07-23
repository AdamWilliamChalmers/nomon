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

function asCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
    const verdict = String(row.verdict || "wrong") === "right" ? "right" : "wrong";
    return {
      userId,
      signalType: String(row.signalType || "unknown").slice(0, 64),
      taskType: String(row.taskType || "general").slice(0, 64),
      verdict,
      score: typeof row.score === "number" ? row.score : undefined,
      stance: typeof row.stance === "string" ? row.stance.slice(0, 64) : undefined,
      dwellRatio: typeof row.dwellRatio === "number" ? row.dwellRatio : undefined,
      pasted: typeof row.pasted === "boolean" ? row.pasted : undefined,
      confidence: typeof row.confidence === "string" ? row.confidence.slice(0, 32) : undefined,
      promptSnippet:
        typeof row.promptSnippet === "string"
          ? sanitizePromptSnippet(row.promptSnippet)
          : undefined,
      platform,
      sessionDate,
    };
  });
}

function buildSignalsBlob(body: Record<string, unknown>) {
  const nested = asObject(body.signals);
  return {
    handoff: asCount(nested.handoff ?? body.handoffCount),
    loop: asCount(nested.loop ?? body.loopCount),
    drift: asCount(nested.drift ?? body.driftCount),
    mismatch: asCount(nested.mismatch ?? body.mismatchCount),
    depth: asCount(nested.depth ?? body.depthCount ?? body.depthMoments),
    engaged: asCount(nested.engaged ?? body.engagedCount),
    scaffold: asCount(nested.scaffold ?? body.scaffoldCount),
    attemptFirst: asCount(nested.attemptFirst ?? body.attemptFirstCount),
  };
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
      stance: row.stance ?? null,
      dwell_ratio: row.dwellRatio ?? null,
      pasted: row.pasted ?? null,
      confidence: row.confidence ?? null,
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
  const platform = String(body.platform || "unknown").slice(0, 120);
  const signals = buildSignalsBlob(body);
  const dynamics = asObject(body.dynamics);
  const responseCounts = asObject(body.responseCounts);
  const taskTypeCounts = asObject(body.taskTypeCounts);
  const platformStats = asObject(body.platformStats);

  const sessionRow = {
    user_id: userId,
    session_date: sessionDate,
    platform,
    schema_version: asCount(body.schemaVersion) || 1,
    duration_minutes: asCount(body.durationMinutes),
    message_count: asCount(body.messageCount),
    composite_score: asCount(body.compositeScore),
    human_state: String(body.humanState || "none").slice(0, 32),
    mode: typeof body.mode === "string" ? body.mode.slice(0, 32) : null,
    badge_enabled: Boolean(body.badgeEnabled),
    depth_moments: signals.depth,
    questions_asked: asCount(body.questionsAsked),
    conscious_delegates: asCount(body.consciousDelegates) || signals.handoff,
    loop_breaks_taken: asCount(body.loopBreaksTaken) || asCount(responseCounts.loopBreaks),
    interventions_fired: asCount(body.interventionsFired),
    interventions_bypassed: asCount(body.interventionsBypassed),
    reflections_submitted: asCount(body.reflectionsSubmitted),
    handoff_count: signals.handoff,
    loop_count: signals.loop,
    drift_count: signals.drift,
    mismatch_count: signals.mismatch,
    engaged_count: signals.engaged,
    scaffold_count: signals.scaffold,
    attempt_first_count: signals.attemptFirst,
    avg_dwell_ratio:
      typeof dynamics.avgDwellRatio === "number" ? dynamics.avgDwellRatio : null,
    low_dwell_count: asCount(dynamics.lowDwellCount),
    paste_count: asCount(dynamics.pasteCount),
    lumi_mode: Boolean(body.lumiMode),
    lumi_rituals_completed: asCount(body.lumiRitualsCompleted),
    lumi_homework_suggested: asCount(body.lumiHomeworkSuggested),
    signals,
    dynamics,
    task_type_counts: taskTypeCounts,
    platform_stats: platformStats,
    response_counts: responseCounts,
    feedback: Array.isArray(body.feedback) ? body.feedback : [],
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
    // Still accept labelled feedback on a duplicate POST (debounced flush).
    if (feedbackRows.length) await persistFeedbackToSupabase(feedbackRows);
    // Refresh the latest row's aggregates so debounced flushes don't drop counts.
    await supabase
      .from("sessions")
      .update({
        message_count: sessionRow.message_count,
        composite_score: sessionRow.composite_score,
        human_state: sessionRow.human_state,
        depth_moments: sessionRow.depth_moments,
        conscious_delegates: sessionRow.conscious_delegates,
        loop_breaks_taken: sessionRow.loop_breaks_taken,
        interventions_fired: sessionRow.interventions_fired,
        interventions_bypassed: sessionRow.interventions_bypassed,
        reflections_submitted: sessionRow.reflections_submitted,
        handoff_count: sessionRow.handoff_count,
        loop_count: sessionRow.loop_count,
        drift_count: sessionRow.drift_count,
        mismatch_count: sessionRow.mismatch_count,
        engaged_count: sessionRow.engaged_count,
        scaffold_count: sessionRow.scaffold_count,
        attempt_first_count: sessionRow.attempt_first_count,
        avg_dwell_ratio: sessionRow.avg_dwell_ratio,
        low_dwell_count: sessionRow.low_dwell_count,
        paste_count: sessionRow.paste_count,
        signals: sessionRow.signals,
        dynamics: sessionRow.dynamics,
        task_type_counts: sessionRow.task_type_counts,
        platform_stats: sessionRow.platform_stats,
        response_counts: sessionRow.response_counts,
        feedback: sessionRow.feedback,
        duration_minutes: sessionRow.duration_minutes,
        mode: sessionRow.mode,
        badge_enabled: sessionRow.badge_enabled,
        schema_version: sessionRow.schema_version,
      })
      .eq("id", dupes[0].id);
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
