"use client";

import { INSIGHT_TEMPLATES } from "@/lib/scoring";
import type { Shape } from "@/lib/shapes";
import { SHAPE_DESCRIPTIONS } from "@/lib/shapes";
import BrandLogo from "@/components/BrandLogo";

const SHAPE_TINT: Record<Shape, { color: string; bg: string }> = {
  Explorer: { color: "#4a9fd4", bg: "rgba(74, 159, 212, 0.08)" },
  Thinker: { color: "#4a9fd4", bg: "rgba(74, 159, 212, 0.08)" },
  Maker: { color: "#4caf50", bg: "rgba(76, 175, 80, 0.08)" },
  Delegator: { color: "#f0a500", bg: "rgba(240, 165, 0, 0.08)" },
  Balanced: { color: "#c8c8c8", bg: "rgba(200, 200, 200, 0.08)" },
};

interface WeeklyCardProps {
  displayName: string;
  weekLabel: string;
  shape: Shape;
  depthMoments: number;
  questionsAsked: number;
  consciousDelegates: number;
  loopBreaks: number;
  intentionalPct: number;
  questionCommandRatio: number;
  depthDeltaLabel: string;
  insightLine: string;
  userId: string;
  weekStart: string;
}

export default function WeeklyCard({
  displayName,
  weekLabel,
  shape,
  depthMoments,
  questionsAsked,
  consciousDelegates,
  loopBreaks,
  intentionalPct,
  questionCommandRatio,
  depthDeltaLabel,
  insightLine,
  userId,
  weekStart,
}: WeeklyCardProps) {
  const share = async () => {
    const url = `${window.location.origin}/card/${userId}?week=${weekStart}`;
    await navigator.clipboard.writeText(url);
  };

  const tint = SHAPE_TINT[shape];

  return (
    <div className="lm-weekly-card">
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div>
          <BrandLogo variant="icon" height={14} className="mb-1" />
          <h2 className="text-[15px] font-medium text-[var(--lm-bright)] mt-1">{weekLabel}</h2>
          <p className="text-[12px] text-[var(--lm-secondary)] mt-0.5">{displayName}</p>
        </div>
        <div
          className="lm-shape-badge"
          style={{ background: tint.bg, color: tint.color }}
        >
          {shape.slice(0, 3)}
        </div>
      </div>

      <p className="text-[12px] text-[var(--lm-secondary)] mb-4 relative z-10 leading-relaxed">
        {SHAPE_DESCRIPTIONS[shape]}
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4 text-[12px] relative z-10">
        <Stat label="Depth moments" value={depthMoments} />
        <Stat label="Questions asked" value={questionsAsked} />
        <Stat label="Conscious delegates" value={consciousDelegates} />
        <Stat label="Loop breaks" value={loopBreaks} />
      </div>

      <div className="space-y-3 mb-4 relative z-10">
        <Bar label="Intentional use" value={intentionalPct} color="var(--lm-loop)" />
        <Bar
          label="Questions vs commands"
          value={Math.round(questionCommandRatio * 100)}
          color="var(--lm-depth)"
        />
        {depthDeltaLabel ? (
          <p className="text-[10px] text-[var(--lm-secondary)]">{depthDeltaLabel}</p>
        ) : null}
      </div>

      <p className="text-[12px] text-[var(--lm-primary)] opacity-80 mb-4 relative z-10 leading-relaxed">
        {insightLine || INSIGHT_TEMPLATES.ordinary}
      </p>

      <button type="button" onClick={share} className="lm-btn w-full relative z-10">
        Share card ↗
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] bg-[var(--lm-void)] border border-[#1a1a1a] p-3">
      <p className="lm-label mb-1">{label}</p>
      <p className="text-[15px] font-medium text-[var(--lm-bright)]">{value}</p>
    </div>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-[var(--lm-secondary)] mb-1">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="lm-bar-track">
        <div className="lm-bar-fill" style={{ width: `${Math.min(100, value)}%`, background: color }} />
      </div>
    </div>
  );
}
