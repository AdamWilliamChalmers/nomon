"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { Suspense, useEffect, useState } from "react";
import FamilySharePanel from "@/components/FamilySharePanel";
import WeeklyCard from "@/components/WeeklyCard";
import SparklineChart from "@/components/SparklineChart";
import SelfComparison from "@/components/SelfComparison";
import type { Shape } from "@/lib/shapes";

function LockedDashboard() {
  const weekStart = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-md mx-auto">
      <p className="lm-label mb-4 text-center">Preview</p>
      <div className="flex justify-center mb-8 opacity-90 pointer-events-none select-none">
        <WeeklyCard
          displayName="You"
          weekLabel={`Week of ${weekStart}`}
          shape="Balanced"
          depthMoments={12}
          questionsAsked={8}
          consciousDelegates={3}
          loopBreaks={2}
          intentionalPct={62}
          questionCommandRatio={0.35}
          depthDeltaLabel=""
          insightLine="Your thinking shape updates every Monday."
          userId="preview"
          weekStart={weekStart}
        />
      </div>
      <ul className="text-[13px] text-[var(--lm-secondary)] space-y-2 mb-8 text-center">
        <li>Full session history</li>
        <li>Weekly card</li>
        <li>Shareable link</li>
      </ul>
      <div className="text-center">
        <Link href="/upgrade" className="lm-btn lm-btn-primary inline-block">
          Unlock Pro — £49 one-time
        </Link>
      </div>
    </div>
  );
}

function DashboardContent() {
  const params = useSearchParams();
  const userId = params.get("userId") || "demo-user";
  const [pro, setPro] = useState<boolean | null>(null);
  const [card, setCard] = useState<Record<string, unknown> | null>(null);
  const [scores, setScores] = useState<number[]>([]);

  useEffect(() => {
    fetch(`/api/user?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => setPro(Boolean(data.pro)))
      .catch(() => setPro(false));
  }, [userId]);

  useEffect(() => {
    if (pro !== true) return;
    fetch(`/api/card?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then(setCard)
      .catch(() => setCard(null));
  }, [userId, pro]);

  if (pro === null) {
    return <p className="text-[var(--lm-secondary)]">Loading dashboard…</p>;
  }

  if (!pro) {
    return <LockedDashboard />;
  }

  if (!card) {
    return <p className="text-[var(--lm-secondary)]">Loading dashboard…</p>;
  }

  const shape = (card.shape as Shape) || "Balanced";
  const weekStart = String(card.weekStart || new Date().toISOString().slice(0, 10));

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <WeeklyCard
        displayName="You"
        weekLabel={`Week of ${weekStart}`}
        shape={shape}
        depthMoments={Number(card.depth_moments) || 0}
        questionsAsked={Number(card.questions_asked) || 0}
        consciousDelegates={Number(card.conscious_delegates) || 0}
        loopBreaks={0}
        intentionalPct={Number(card.intentional_pct) || 50}
        questionCommandRatio={Number(card.questionCommandRatio) || 0.3}
        depthDeltaLabel="Depth rate vs last week"
        insightLine={String(card.insightLine || "")}
        userId={userId}
        weekStart={weekStart}
      />
      <div className="space-y-6">
        <div className="lm-surface p-4">
          <p className="lm-label mb-3">Score history</p>
          <SparklineChart scores={scores} />
        </div>
        <SelfComparison
          thisWeek={{
            intentional_pct: Number(card.intentional_pct) || 0,
            questions_asked: Number(card.questions_asked) || 0,
            depth_moments: Number(card.depth_moments) || 0,
          }}
        />
        <FamilySharePanel childUserId={userId} childDisplayName="You" />
        <div className="lm-surface p-4">
          <p className="lm-label mb-2">Signal trust</p>
          <p className="text-[12px] text-[var(--lm-secondary)] mb-3">
            False-positive rates and crowd-derived model weights from strip corrections.
          </p>
          <Link href="/calibration" className="lm-link text-[12px]">
            Open calibration dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="lm-app-shell max-w-5xl mx-auto px-6 py-12">
      <BrandLogo variant="icon" height={16} className="mb-3" />
      <h1 className="lm-page-title mb-8">Dashboard</h1>
      <Suspense fallback={<p className="text-[var(--lm-secondary)]">Loading…</p>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
