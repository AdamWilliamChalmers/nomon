export type FeedbackRow = {
  signalType?: string;
  taskType?: string;
  verdict?: string;
  platform?: string;
  sessionDate?: string;
  score?: number;
  userId?: string;
  promptSnippet?: string;
};

const memoryFeedback: FeedbackRow[] = [];

export function pushFeedback(rows: FeedbackRow[]) {
  memoryFeedback.push(...rows);
}

export function listFeedbackRows() {
  return [...memoryFeedback];
}

export function aggregateFeedbackRows(rows: FeedbackRow[]) {
  const bySignal: Record<string, { wrong: number; total: number }> = {};
  const byTask: Record<string, { wrong: number; total: number }> = {};
  const byPlatform: Record<string, { wrong: number; total: number }> = {};

  for (const row of rows) {
    const sig = row.signalType || "unknown";
    const task = row.taskType || "general";
    const platform = row.platform || "unknown";
    bySignal[sig] = bySignal[sig] || { wrong: 0, total: 0 };
    byTask[task] = byTask[task] || { wrong: 0, total: 0 };
    byPlatform[platform] = byPlatform[platform] || { wrong: 0, total: 0 };
    bySignal[sig].total += 1;
    byTask[task].total += 1;
    byPlatform[platform].total += 1;
    if (row.verdict === "wrong") {
      bySignal[sig].wrong += 1;
      byTask[task].wrong += 1;
      byPlatform[platform].wrong += 1;
    }
  }

  const toRates = (entries: [string, { wrong: number; total: number }][]) =>
    entries
      .map(([key, counts]) => ({
        key,
        falsePositiveRate: counts.total ? Math.round((counts.wrong / counts.total) * 100) : 0,
        wrong: counts.wrong,
        total: counts.total,
      }))
      .sort((a, b) => b.falsePositiveRate - a.falsePositiveRate);

  return {
    rates: toRates(Object.entries(bySignal)).map(({ key, ...rest }) => ({
      signalType: key,
      ...rest,
    })),
    byTaskType: toRates(Object.entries(byTask)).map(({ key, ...rest }) => ({
      taskType: key,
      ...rest,
    })),
    byPlatform: toRates(Object.entries(byPlatform)).map(({ key, ...rest }) => ({
      platform: key,
      ...rest,
    })),
    totalSamples: rows.length,
  };
}

export function getFeedbackAggregate() {
  return aggregateFeedbackRows(memoryFeedback);
}
