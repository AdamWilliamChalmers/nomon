import type { FeedbackRow } from "./feedbackMemory";

export type TaskTypeModifier = {
  scoreMultiplier: number;
  reason?: string;
};

export type CrowdCalibration = {
  taskTypeModifiers: Record<string, TaskTypeModifier>;
  loopThreshold: number;
  signalAdjustments: Array<{ signalType: string; falsePositiveRate: number; samples: number }>;
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

function fpRate(wrong: number, total: number) {
  return total ? wrong / total : 0;
}

function multiplierFromFpRate(rate: number, base: number) {
  if (rate >= 0.5) return Math.max(0.1, base * 0.5);
  if (rate >= 0.35) return Math.max(0.15, base * 0.65);
  if (rate >= 0.25) return Math.max(0.2, base * 0.8);
  if (rate >= 0.15) return Math.max(0.25, base * 0.9);
  return base;
}

export function deriveCrowdCalibration(rows: FeedbackRow[]): CrowdCalibration {
  const byTask: Record<string, { wrong: number; total: number }> = {};
  const bySignal: Record<string, { wrong: number; total: number }> = {};

  for (const row of rows) {
    const task = row.taskType || "general";
    const sig = row.signalType || "unknown";
    byTask[task] = byTask[task] || { wrong: 0, total: 0 };
    bySignal[sig] = bySignal[sig] || { wrong: 0, total: 0 };
    byTask[task].total += 1;
    bySignal[sig].total += 1;
    if (row.verdict === "wrong") {
      byTask[task].wrong += 1;
      bySignal[sig].wrong += 1;
    }
  }

  const taskTypeModifiers: Record<string, TaskTypeModifier> = {};
  for (const [taskType, base] of Object.entries(BASE_TASK_TYPE_MODIFIERS)) {
    const counts = byTask[taskType];
    if (!counts || counts.total < MIN_SAMPLES) {
      taskTypeModifiers[taskType] = { scoreMultiplier: base };
      continue;
    }
    const rate = fpRate(counts.wrong, counts.total);
    const adjusted = multiplierFromFpRate(rate, base);
    taskTypeModifiers[taskType] = {
      scoreMultiplier: Math.round(adjusted * 100) / 100,
      reason:
        adjusted < base
          ? `${Math.round(rate * 100)}% false positive over ${counts.total} samples`
          : undefined,
    };
  }

  const signalAdjustments = Object.entries(bySignal)
    .filter(([, c]) => c.total >= MIN_SAMPLES)
    .map(([signalType, counts]) => ({
      signalType,
      falsePositiveRate: Math.round(fpRate(counts.wrong, counts.total) * 100),
      samples: counts.total,
    }))
    .sort((a, b) => b.falsePositiveRate - a.falsePositiveRate);

  let loopThreshold = BASE_LOOP_THRESHOLD;
  const loopFp = bySignal.loop;
  if (loopFp && loopFp.total >= MIN_SAMPLES) {
    const rate = fpRate(loopFp.wrong, loopFp.total);
    if (rate >= 0.35) loopThreshold = 52;
    else if (rate >= 0.25) loopThreshold = 48;
    else if (rate >= 0.15) loopThreshold = 44;
  }

  const handoffFp = bySignal.handoff;
  if (handoffFp && handoffFp.total >= MIN_SAMPLES) {
    const rate = fpRate(handoffFp.wrong, handoffFp.total);
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
