"use client";

import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const QUESTIONS = [
  "Actively evaluated the AI's responses critically?",
  "Contributed your own thinking before asking AI?",
  "Understood the reasoning behind the AI's answers?",
  "Would have been able to produce a similar result yourself?",
  "Feel like you did the thinking, with AI assisting?",
];

function SurveyForm() {
  const params = useSearchParams();
  const [answers, setAnswers] = useState<number[]>([4, 4, 4, 4, 4]);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  const userId =
    typeof window !== "undefined"
      ? localStorage.getItem("lumenUserId") || "anonymous"
      : "anonymous";
  const sessionDate = params.get("date") || new Date().toISOString().slice(0, 10);
  const platform = params.get("platform") || "unknown";
  const compositeScore = params.get("score") ? Number(params.get("score")) : undefined;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          sessionDate,
          platform,
          compositeScore,
          q1: answers[0],
          q2: answers[1],
          q3: answers[2],
          q4: answers[3],
          q5: answers[4],
        }),
      });
      if (!res.ok) throw new Error("submit failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="lm-surface p-6 max-w-lg mx-auto text-center">
        <p className="lm-page-title mb-2">Thank you</p>
        <p className="text-[13px] text-[var(--lm-secondary)] mb-6">
          Your responses are paired with this session&apos;s Lumen scores for calibration research.
        </p>
        <Link href="/calibration" className="lm-btn lm-btn-primary inline-block">
          View calibration dashboard
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="lm-surface p-6 max-w-lg mx-auto space-y-6">
      <div>
        <p className="lm-label mb-1">Calibration study</p>
        <p className="text-[13px] text-[var(--lm-secondary)]">
          After this session, how much would you say you… (1 = not at all, 7 = completely)
        </p>
      </div>

      {QUESTIONS.map((label, index) => (
        <label key={label} className="block">
          <span className="text-[12px] text-[var(--lm-primary)] block mb-2">
            {index + 1}. {label}
          </span>
          <input
            type="range"
            min={1}
            max={7}
            value={answers[index]}
            onChange={(e) => {
              const next = [...answers];
              next[index] = Number(e.target.value);
              setAnswers(next);
            }}
            className="w-full"
          />
          <span className="text-[11px] text-[var(--lm-muted)]">{answers[index]} / 7</span>
        </label>
      ))}

      <button
        type="submit"
        disabled={status === "sending"}
        className="lm-btn lm-btn-primary w-full disabled:opacity-40"
      >
        {status === "sending" ? "Submitting…" : "Submit (about 30 seconds)"}
      </button>

      {status === "error" && (
        <p className="text-[12px] text-[#f44336]">Could not submit — try again.</p>
      )}

      <p className="text-[10px] text-[var(--lm-muted)]">
        Voluntary · Session {sessionDate} · {platform}
      </p>
    </form>
  );
}

export default function SurveyPage() {
  return (
    <main className="lm-app-shell max-w-3xl mx-auto px-6 py-12">
      <BrandLogo variant="icon" height={16} className="mx-auto mb-3" />
      <h1 className="lm-page-title text-center mb-8">Session reflection</h1>
      <Suspense fallback={<p className="text-center text-[var(--lm-secondary)]">Loading…</p>}>
        <SurveyForm />
      </Suspense>
    </main>
  );
}
