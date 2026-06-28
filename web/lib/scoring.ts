export const INSIGHT_TEMPLATES = {
  thinker_high: "High engagement week — more evaluation moments than usual.",
  explorer_high: "Questioning mode all week — more pushback and follow-up than usual.",
  delegator:
    "Mostly acceptance mode this week. Worth checking a few of those responses still sound like your thinking.",
  maker: "Maker week — high conscious delegation. Intentionality held steady.",
  overwhelmed: "Heavy session mid-week flagged as overwhelmed. You kept going.",
  ordinary: "Consistent with your baseline. A steady week.",
  recovery: "Strong depth recovery after a passive start.",
  mixed: "Mixed signals this week — passive early, more engaged by end.",
} as const;

export type InsightKey = keyof typeof INSIGHT_TEMPLATES;

export interface WeekMetrics {
  depth_moments: number;
  questions_asked: number;
  conscious_delegates: number;
  total_messages: number;
  intentional_pct: number;
  human_states: string[];
  avgDwellRatio: number | null;
  lowDwellSessions: number;
  dominantTier: string | null;
}

export function pickInsight(thisWeek: WeekMetrics, lastWeek?: WeekMetrics | null): string {
  if (!lastWeek || lastWeek.total_messages === 0) {
    return INSIGHT_TEMPLATES.ordinary;
  }

  const depthDelta = thisWeek.depth_moments - lastWeek.depth_moments;
  const questionDelta = thisWeek.questions_asked - lastWeek.questions_asked;

  if (thisWeek.human_states.includes("overwhelmed")) {
    return INSIGHT_TEMPLATES.overwhelmed;
  }
  if (depthDelta > 2 && thisWeek.depth_moments > lastWeek.depth_moments * 1.5) {
    return INSIGHT_TEMPLATES.thinker_high;
  }
  if (questionDelta > 3) {
    return INSIGHT_TEMPLATES.explorer_high;
  }
  if (thisWeek.conscious_delegates > 2 && thisWeek.intentional_pct >= 70) {
    return INSIGHT_TEMPLATES.maker;
  }
  if (thisWeek.intentional_pct < 45) {
    return INSIGHT_TEMPLATES.delegator;
  }
  if (thisWeek.depth_moments > lastWeek.depth_moments && lastWeek.depth_moments < 2) {
    return INSIGHT_TEMPLATES.recovery;
  }
  if (Math.abs(thisWeek.intentional_pct - lastWeek.intentional_pct) > 20) {
    return INSIGHT_TEMPLATES.mixed;
  }

  return INSIGHT_TEMPLATES.ordinary;
}

export function aggregateSessions(
  sessions: Array<{
    message_count?: number | null;
    depth_moments?: number | null;
    questions_asked?: number | null;
    conscious_delegates?: number | null;
    composite_score?: number | null;
    human_state?: string | null;
    avg_dwell_ratio?: number | null;
    low_dwell_count?: number | null;
    dominant_load_tier?: Record<string, number> | null;
  }>
): WeekMetrics {
  let depth = 0;
  let questions = 0;
  let delegates = 0;
  let messages = 0;
  let compositeSum = 0;
  const human_states: string[] = [];
  const dwellRatios: number[] = [];
  let lowDwellSessions = 0;
  const tierTotals: Record<string, number> = {};

  for (const s of sessions) {
    depth += s.depth_moments ?? 0;
    questions += s.questions_asked ?? 0;
    delegates += s.conscious_delegates ?? 0;
    messages += s.message_count ?? 0;
    compositeSum += (s.composite_score ?? 0) * (s.message_count ?? 1);
    if (s.human_state && s.human_state !== "none") human_states.push(s.human_state);
    if (s.avg_dwell_ratio != null) dwellRatios.push(s.avg_dwell_ratio);
    if ((s.low_dwell_count ?? 0) > 0) lowDwellSessions += 1;
    if (s.dominant_load_tier) {
      for (const [tier, count] of Object.entries(s.dominant_load_tier)) {
        tierTotals[tier] = (tierTotals[tier] || 0) + count;
      }
    }
  }

  const intentional_pct =
    messages > 0 ? Math.round(100 - compositeSum / Math.max(messages, 1)) : 50;

  const dominantTier =
    Object.keys(tierTotals).length > 0
      ? Object.entries(tierTotals).sort((a, b) => b[1] - a[1])[0][0]
      : null;

  return {
    depth_moments: depth,
    questions_asked: questions,
    conscious_delegates: delegates,
    total_messages: messages,
    intentional_pct: Math.max(0, Math.min(100, intentional_pct)),
    human_states,
    avgDwellRatio: dwellRatios.length
      ? dwellRatios.reduce((a, b) => a + b, 0) / dwellRatios.length
      : null,
    lowDwellSessions,
    dominantTier,
  };
}

export function formatDelta(current: number, previous: number, suffix = ""): string {
  if (previous === 0 && current === 0) return "same as last week";
  if (previous === 0) return `+${current}${suffix} vs last week`;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return "same as last week";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}%${suffix} vs last week`;
}
