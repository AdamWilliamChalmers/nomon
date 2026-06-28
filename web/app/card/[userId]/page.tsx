"use client";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import WeeklyCard from "@/components/WeeklyCard";
import type { Shape } from "@/lib/shapes";

function CardContent() {
  const params = useParams();
  const search = useSearchParams();
  const userId = String(params.userId);
  const week = search.get("week") || new Date().toISOString().slice(0, 10);
  const [card, setCard] = useState<Record<string, unknown> | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/user?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((user) => {
        if (!user.pro) {
          setBlocked(true);
          setLoading(false);
          return;
        }
        return fetch(`/api/card?userId=${encodeURIComponent(userId)}&week=${week}`)
          .then((r) => {
            if (!r.ok) throw new Error("forbidden");
            return r.json();
          })
          .then((data) => setCard(data));
      })
      .catch(() => setBlocked(true))
      .finally(() => setLoading(false));
  }, [userId, week]);

  if (loading) {
    return <p className="text-[var(--lm-secondary)] p-8">Loading card…</p>;
  }

  if (blocked || !card) {
    return (
      <main className="lm-app-shell min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="text-[15px] text-[var(--lm-bright)] mb-3">
            This user hasn&apos;t unlocked card sharing yet
          </p>
          <Link href="/" className="lm-link text-[12px]">
            ← Back to Lumen
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="flex justify-center p-8">
      <WeeklyCard
        displayName="Lumen user"
        weekLabel={`Week of ${week}`}
        shape={(card.shape as Shape) || "Balanced"}
        depthMoments={Number(card.depth_moments) || 0}
        questionsAsked={Number(card.questions_asked) || 0}
        consciousDelegates={Number(card.conscious_delegates) || 0}
        loopBreaks={0}
        intentionalPct={Number(card.intentional_pct) || 50}
        questionCommandRatio={Number(card.questionCommandRatio) || 0.3}
        depthDeltaLabel=""
        insightLine={String(card.insightLine || "")}
        userId={userId}
        weekStart={week}
      />
    </div>
  );
}

export default function PublicCardPage() {
  return (
    <main className="lm-app-shell min-h-screen">
      <Suspense fallback={<p className="text-[var(--lm-secondary)] p-8">Loading…</p>}>
        <CardContent />
      </Suspense>
    </main>
  );
}
