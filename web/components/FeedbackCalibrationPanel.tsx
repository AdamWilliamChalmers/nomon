"use client";

import { useEffect, useState } from "react";

type RateRow = {
  signalType?: string;
  taskType?: string;
  platform?: string;
  falsePositiveRate: number;
  wrong: number;
  total: number;
};

type CalibrationPayload = {
  totalSamples: number;
  source?: string;
  rates: RateRow[];
  byTaskType: RateRow[];
  byPlatform: RateRow[];
  calibration: {
    sampleCount: number;
    loopThreshold: number;
    signalAdjustments: Array<{ signalType: string; falsePositiveRate: number; samples: number }>;
    taskTypeModifiers: Record<string, { scoreMultiplier: number; reason?: string }>;
    updatedAt: string;
  };
};

function RateTable({
  title,
  rows,
  keyField,
}: {
  title: string;
  rows: RateRow[];
  keyField: "signalType" | "taskType" | "platform";
}) {
  if (!rows.length) {
    return (
      <div className="lm-surface p-4">
        <p className="lm-label mb-2">{title}</p>
        <p className="text-[12px] text-[var(--lm-muted)]">No samples yet.</p>
      </div>
    );
  }

  return (
    <div className="lm-surface p-4">
      <p className="lm-label mb-3">{title}</p>
      <div className="space-y-2">
        {rows.map((row) => {
          const label = String(row[keyField] || "unknown");
          const hot = row.falsePositiveRate >= 30;
          return (
            <div key={label} className="flex justify-between items-center text-[12px] gap-4">
              <span className="text-[var(--lm-secondary)] truncate">{label.replace(/_/g, " ")}</span>
              <span className="shrink-0 tabular-nums" style={{ color: hot ? "#f44336" : "var(--lm-primary)" }}>
                {row.falsePositiveRate}% wrong · {row.wrong}/{row.total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FeedbackCalibrationPanel() {
  const [data, setData] = useState<CalibrationPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/feedback")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Could not load calibration data."));
  }, []);

  if (error) return <p className="text-[12px] text-[#f44336]">{error}</p>;
  if (!data) return <p className="text-[12px] text-[var(--lm-secondary)]">Loading calibration…</p>;

  const { calibration } = data;
  const adjustedTasks = Object.entries(calibration.taskTypeModifiers).filter(
    ([, mod]) => mod.reason
  );

  return (
    <div className="space-y-6">
      <div className="lm-surface p-4">
        <p className="lm-label mb-2">Flywheel status</p>
        <p className="text-[13px] text-[var(--lm-primary)]">
          {data.totalSamples} labelled corrections · source: {data.source || "memory"}
        </p>
        <p className="text-[11px] text-[var(--lm-muted)] mt-2">
          Every ✕ on a strip is training data. Crowd weights push to the extension via{" "}
          <code className="text-[var(--lm-secondary)]">/api/calibration/weights</code>.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <RateTable title="By signal" rows={data.rates} keyField="signalType" />
        <RateTable title="By task type" rows={data.byTaskType} keyField="taskType" />
        <RateTable title="By platform" rows={data.byPlatform} keyField="platform" />
      </div>

      <div className="lm-surface p-4">
        <p className="lm-label mb-3">Crowd-derived weights (live)</p>
        <div className="grid sm:grid-cols-2 gap-4 text-[12px]">
          <div>
            <p className="text-[var(--lm-secondary)] mb-1">Loop threshold</p>
            <p className="text-[var(--lm-bright)] font-medium">{calibration.loopThreshold}</p>
            <p className="text-[10px] text-[var(--lm-muted)] mt-1">Base: 40 · raised when loop FP rate is high</p>
          </div>
          <div>
            <p className="text-[var(--lm-secondary)] mb-1">Last updated</p>
            <p className="text-[var(--lm-primary)]">
              {new Date(calibration.updatedAt).toLocaleString()}
            </p>
          </div>
        </div>

        {adjustedTasks.length > 0 ? (
          <div className="mt-4 pt-4 border-t border-[var(--lm-raised)]">
            <p className="text-[11px] text-[var(--lm-secondary)] mb-2">Task types auto-tuned from feedback</p>
            <div className="space-y-2">
              {adjustedTasks.map(([task, mod]) => (
                <div key={task} className="flex justify-between text-[12px] gap-4">
                  <span className="text-[var(--lm-secondary)]">{task.replace(/_/g, " ")}</span>
                  <span className="text-[var(--lm-primary)] shrink-0">
                    ×{mod.scoreMultiplier} — {mod.reason}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-[var(--lm-muted)] mt-4">
            Need ≥3 wrong-signal samples per task type before multipliers adjust.
          </p>
        )}
      </div>
    </div>
  );
}
