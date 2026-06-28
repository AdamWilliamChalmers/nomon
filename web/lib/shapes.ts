export type Shape = "Explorer" | "Thinker" | "Maker" | "Delegator" | "Balanced";

export interface WeeklySummary {
  intentional_pct: number;
  questions_asked: number;
  depth_moments: number;
  conscious_delegates: number;
  total_messages: number;
  avgDwellRatio?: number | null;
  lowDwellSessions?: number;
  dominantTier?: string | null;
}

export function classifyShape(summary: WeeklySummary): Shape {
  const {
    intentional_pct,
    questions_asked,
    depth_moments,
    conscious_delegates,
    total_messages,
    avgDwellRatio,
    dominantTier,
  } = summary;

  if (total_messages === 0) return "Balanced";

  if (
    avgDwellRatio != null &&
    avgDwellRatio < 0.25 &&
    dominantTier === "germane"
  ) {
    return "Delegator";
  }

  const questionRate = questions_asked / total_messages;
  const depthRate = depth_moments / total_messages;
  const delegateRate = conscious_delegates / total_messages;

  if (questionRate > 0.5) return "Explorer";
  if (depthRate > 0.25) return "Thinker";
  if (delegateRate > 0.3 && intentional_pct > 70) return "Maker";
  if (intentional_pct < 50) return "Delegator";
  return "Balanced";
}

export const SHAPE_DESCRIPTIONS: Record<Shape, string> = {
  Explorer: "More questions than commands this week",
  Thinker: "Depth moments dominated your sessions",
  Maker: "High conscious delegation, steady intent",
  Delegator: "Mostly acceptance mode — worth checking responses still sound like your thinking",
  Balanced: "A mix of thinking and accepting",
};
