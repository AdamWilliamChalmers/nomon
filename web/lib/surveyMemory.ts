export type SurveyResponse = {
  userId: string;
  sessionDate: string;
  platform: string;
  compositeScore?: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  q5: number;
  createdAt: number;
};

const memoryResponses: SurveyResponse[] = [];

export function pushSurveyResponse(row: SurveyResponse) {
  memoryResponses.push(row);
}

export function listSurveyResponses() {
  return [...memoryResponses];
}

export function getSurveyAggregate() {
  const rows = memoryResponses;
  if (!rows.length) {
    return { count: 0, avgEngagement: null, avgCompositeScore: null, correlationNote: null };
  }

  const engagement = rows.map((r) => (r.q1 + r.q2 + r.q3 + r.q4 + r.q5) / 5);
  const avgEngagement = engagement.reduce((a, b) => a + b, 0) / engagement.length;
  const withComposite = rows.filter((r) => typeof r.compositeScore === "number");
  const avgCompositeScore =
    withComposite.length > 0
      ? withComposite.reduce((s, r) => s + (r.compositeScore || 0), 0) / withComposite.length
      : null;

  return {
    count: rows.length,
    avgEngagement: Math.round(avgEngagement * 10) / 10,
    avgCompositeScore: avgCompositeScore != null ? Math.round(avgCompositeScore) : null,
    correlationNote:
      withComposite.length >= 10
        ? "Enough paired samples to run correlation — export via GET /api/survey"
        : `Need ${10 - withComposite.length} more paired session+survey rows for correlation`,
  };
}
