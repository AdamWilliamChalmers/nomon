import type { FeedbackRow } from "./feedbackMemory";

export type TaskTypeModifier = {
  scoreMultiplier: number;
  reason?: string;
};

export type CrowdCalibration = {
  taskTypeModifiers: Record<string, TaskTypeModifier>;
  loopThreshold: number;
  signalAdjustments: Array<{
    signalType: string;
    falsePositiveRate: number;
    samples: number;
    right?: number;
    wrong?: number;
  }>;
  sampleCount: number;
  updatedAt: string;
};

const BASE_LOOP_THRESHOLD = 40;
const MIN_SAMPLES = 3;

/** Default multipliers — must stay in sync with extension/engine.js TASK_TYPE_MODIFIERS */
export const BASE_TASK_TYPE_MODIFIERS: Record<string, number> = {
  email_drafting: 0.15,
  scheduling: 0.1,
  formatting: 0.15,
  conversion: 0.1,
  translation: 0.2,
  summarisation: 0.3,
  fact_checking: 0.35,
  literature_search: 0.4,
  debugging: 0.5,
  code_generation: 0.65,
  data_analysis: 0.55,
  research: 0.45,
  essay_writing: 1.0,
  argument_building: 1.0,
  decision_making: 1.1,
  learning_concept: 1.2,
  creative_writing: 0.9,
  reflection: 1.2,
  code_explanation: 0.9,
  general: 0.45,
};

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

function multiplierFromFpRate(rate: number, base: number) {
  if (rate >= 0.5) return Math.max(0.1, base * 0.5);
  if (rate >= 0.35) return Math.max(0.15, base * 0.65);
  if (rate >= 0.25) return Math.max(0.2, base * 0.8);
  if (rate >= 0.15) return Math.max(0.25, base * 0.9);
  // Confirmed-true feedback can gently restore toward base.
  if (rate <= 0.05) return Math.min(1.3, base * 1.05);
  return base;
}

export function deriveCrowdCalibration(rows: FeedbackRow[]): CrowdCalibration {
  const byTask: Record<string, Bucket> = {};
  const bySignal: Record<string, Bucket> = {};

  for (const row of rows) {
    const task = row.taskType || "general";
    const sig = row.signalType || "unknown";
    byTask[task] = byTask[task] || emptyBucket();
    bySignal[sig] = bySignal[sig] || emptyBucket();
    bump(byTask[task], row.verdict);
    bump(bySignal[sig], row.verdict);
  }

  const taskTypeModifiers: Record<string, TaskTypeModifier> = {};
  for (const [taskType, base] of Object.entries(BASE_TASK_TYPE_MODIFIERS)) {
    const counts = byTask[taskType];
    if (!counts || counts.total < MIN_SAMPLES) {
      taskTypeModifiers[taskType] = { scoreMultiplier: base };
      continue;
    }
    const labeled = counts.wrong + counts.right;
    const rate = fpRate(counts.wrong, labeled || counts.total);
    const adjusted = multiplierFromFpRate(rate, base);
    taskTypeModifiers[taskType] = {
      scoreMultiplier: Math.round(adjusted * 100) / 100,
      reason:
        adjusted !== base
          ? `${Math.round(rate * 100)}% false positive over ${counts.total} samples (${counts.right} right)`
          : undefined,
    };
  }

  const signalAdjustments = Object.entries(bySignal)
    .filter(([, c]) => c.total >= MIN_SAMPLES)
    .map(([signalType, counts]) => {
      const labeled = counts.wrong + counts.right;
      return {
        signalType,
        falsePositiveRate: Math.round(fpRate(counts.wrong, labeled || counts.total) * 100),
        samples: counts.total,
        right: counts.right,
        wrong: counts.wrong,
      };
    })
    .sort((a, b) => b.falsePositiveRate - a.falsePositiveRate);

  let loopThreshold = BASE_LOOP_THRESHOLD;
  const loopFp = bySignal.loop;
  if (loopFp && loopFp.total >= MIN_SAMPLES) {
    const labeled = loopFp.wrong + loopFp.right;
    const rate = fpRate(loopFp.wrong, labeled || loopFp.total);
    if (rate >= 0.35) loopThreshold = 52;
    else if (rate >= 0.25) loopThreshold = 48;
    else if (rate >= 0.15) loopThreshold = 44;
    else if (rate <= 0.05 && loopFp.right >= MIN_SAMPLES) loopThreshold = 38;
  }

  const handoffFp = bySignal.handoff;
  if (handoffFp && handoffFp.total >= MIN_SAMPLES) {
    const labeled = handoffFp.wrong + handoffFp.right;
    const rate = fpRate(handoffFp.wrong, labeled || handoffFp.total);
    if (rate >= 0.3) loopThreshold = Math.max(loopThreshold, 46);
  }

  return {
    taskTypeModifiers,
    loopThreshold,
    signalAdjustments,
    sampleCount: rows.length,
    updatedAt: new Date().toISOString(),
  };
}
