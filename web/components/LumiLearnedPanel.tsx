"use client";

import { useEffect, useState } from "react";

interface Props {
  userId: string;
  weekStart: string;
  onSaved?: (text: string) => void;
}

export default function LumiLearnedPanel({ userId, weekStart, onSaved }: Props) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(
      `/api/lumi/learned?userId=${encodeURIComponent(userId)}&week=${encodeURIComponent(weekStart)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.learnedMoment) setText(data.learnedMoment);
      })
      .finally(() => setLoading(false));
  }, [userId, weekStart]);

  const save = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const res = await fetch("/api/lumi/learned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, text: trimmed, weekStart }),
    });
    if (res.ok) {
      setSaved(true);
      onSaved?.(trimmed);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="lm-surface p-4 border border-[#e9d5ff]/30">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#a78bfa] mb-1">
        Lumi
      </p>
      <h3 className="text-[14px] font-medium text-[var(--lm-bright)] mb-1">
        One thing I learned this week
      </h3>
      <p className="text-[12px] text-[var(--lm-secondary)] mb-3 leading-relaxed">
        Something you actually understood — not copied. Optional share with family on your weekly
        card.
      </p>
      {loading ? (
        <p className="text-[12px] text-[var(--lm-secondary)]">Loading…</p>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder="e.g. How photosynthesis actually works, not just the definition…"
            className="w-full min-h-[80px] rounded-[8px] bg-[var(--lm-void)] border border-[#1a1a1a] p-3 text-[13px] text-[var(--lm-primary)] resize-y"
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] text-[var(--lm-secondary)]">{text.length}/500</span>
            <button type="button" onClick={save} className="lm-btn text-[12px]">
              {saved ? "Saved ✓" : "Save highlight"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
