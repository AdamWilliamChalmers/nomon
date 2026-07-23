export type FeedbackRow = {
  signalType?: string;
  taskType?: string;
  verdict?: string;
  platform?: string;
  sessionDate?: string;
  score?: number;
  userId?: string;
  promptSnippet?: string;
  stance?: string;
  dwellRatio?: number;
  pasted?: boolean;
  confidence?: string;
};

const memoryFeedback: FeedbackRow[] = [];

export function pushFeedback(rows: FeedbackRow[]) {
  memoryFeedback.push(...rows);
}

export function listFeedbackRows() {
  return [...memoryFeedback];
}

type Bucket = { wrong: number; right: number; total: number };

function emptyBucket(): Bucket {
  return { wrong: 0, right: 0, total: 0 };
}

function bump(bucket: Bucket, verdict?: string) {
  bucket.total += 1;
  if (verdict === "right") bucket.right += 1;
  else bucket.wrong += 1;
}

function fpRate(wrong: number, labeled: number) {
  return labeled ? wrong / labeled : 0;
}

export function aggregateFeedbackRows(rows: FeedbackRow[]) {
  const bySignal: Record<string, Bucket> = {};
  const byTask: Record<string, Bucket> = {};
  const byPlatform: Record<string, Bucket> = {};
  const byStance: Record<string, Bucket> = {};

  for (const row of rows) {
    const sig = row.signalType || "unknown";
    const task = row.taskType || "general";
    const platform = row.platform || "unknown";
    const stance = row.stance || "unspecified";
    bySignal[sig] = bySignal[sig] || emptyBucket();
    byTask[task] = byTask[task] || emptyBucket();
    byPlatform[platform] = byPlatform[platform] || emptyBucket();
    byStance[stance] = byStance[stance] || emptyBucket();
    bump(bySignal[sig], row.verdict);
    bump(byTask[task], row.verdict);
    bump(byPlatform[platform], row.verdict);
    bump(byStance[stance], row.verdict);
  }

  const toRates = (entries: [string, Bucket][]) =>
    entries
      .map(([key, counts]) => {
        const labeled = counts.wrong + counts.right;
        return {
          key,
          falsePositiveRate: Math.round(fpRate(counts.wrong, labeled || counts.total) * 100),
          wrong: counts.wrong,
          right: counts.right,
          total: counts.total,
        };
      })
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
    byStance: toRates(Object.entries(byStance)).map(({ key, ...rest }) => ({
      stance: key,
      ...rest,
    })),
    totalSamples: rows.length,
    rightSamples: rows.filter((r) => r.verdict === "right").length,
    wrongSamples: rows.filter((r) => r.verdict !== "right").length,
  };
}

export function getFeedbackAggregate() {
  return aggregateFeedbackRows(memoryFeedback);
}
