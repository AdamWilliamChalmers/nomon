"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ConsentForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function confirm() {
    setStatus("loading");
    const res = await fetch("/api/family/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus("error");
      setMessage(data.error || "Could not confirm");
      return;
    }
    setStatus("done");
    setMessage(data.message);
  }

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">Parental consent</h1>
      <p className="text-sm text-gray-600 mb-6">
        Your child (age 13–17) requested a Nomon account. Nomon collects behavioural signals only —
        not conversation content.
      </p>

      <div className="text-sm space-y-3 mb-6 border rounded-lg p-4 bg-gray-50">
        <p>
          <strong>Collects:</strong> prompt length, message velocity, session shape trends
        </p>
        <p>
          <strong>Never collects:</strong> prompts, AI responses, or session-by-session surveillance
          data
        </p>
        <p>
          <strong>Family sharing:</strong> Your child must invite you. You only see their weekly
          card if they choose to share.
        </p>
      </div>

      {status === "done" ? (
        <p className="text-green-700 text-sm">{message}</p>
      ) : (
        <button
          type="button"
          onClick={confirm}
          disabled={!token || status === "loading"}
          className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium disabled:opacity-40"
        >
          {status === "loading" ? "Confirming…" : "I consent — activate account"}
        </button>
      )}

      {status === "error" && <p className="text-red-600 text-sm mt-3">{message}</p>}

      <p className="text-xs text-gray-400 mt-6">
        <Link href="/">Learn more about Nomon</Link>
      </p>
    </div>
  );
}

export default function ConsentPage() {
  return (
    <main className="min-h-screen">
      <Suspense fallback={<p className="p-8">Loading…</p>}>
        <ConsentForm />
      </Suspense>
    </main>
  );
}
