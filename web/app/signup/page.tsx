"use client";

import { useState } from "react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  const age = birthYear ? new Date().getFullYear() - Number(birthYear) : null;
  const needsParent = age !== null && age >= 13 && age <= 17;
  const tooYoung = age !== null && age < 13;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    const res = await fetch("/api/family/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        displayName,
        birthYear: Number(birthYear),
        parentEmail: needsParent ? parentEmail : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Signup failed");
      return;
    }
    setResult(data);
  }

  return (
    <main className="max-w-md mx-auto px-6 py-12">
      <BrandLogo variant="full" height={56} className="mb-6" />
      <h1 className="text-2xl font-bold mb-2">Create your Lumen account</h1>
      <p className="text-sm text-gray-600 mb-8">
        Minimum age 13. Ages 13–17 require a parent/guardian to confirm before activation.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Display name
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Birth year
          <input
            type="number"
            required
            min={1990}
            max={new Date().getFullYear()}
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2"
          />
        </label>

        {tooYoung && (
          <p className="text-sm text-amber-800 bg-amber-50 p-3 rounded-lg">
            Lumen is not available for under-13s. This is a content-filter / screen-time product
            category — not what Lumen builds.
          </p>
        )}

        {needsParent && (
          <label className="block text-sm">
            Parent/guardian email
            <input
              type="email"
              required
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={tooYoung}
          className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium disabled:opacity-40"
        >
          Continue
        </button>
      </form>

      {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
      {result && (
        <div className="mt-4 text-sm bg-green-50 border border-green-100 rounded-lg p-4">
          <p>{String(result.message || "Account created.")}</p>
          {result.apiToken ? (
            <p className="mt-2 text-xs break-all">
              API token (paste into extension settings):{" "}
              <code className="font-mono">{String(result.apiToken)}</code>
            </p>
          ) : null}
          {result.consentUrl ? (
            <p className="mt-2">
              Parent consent link:{" "}
              <Link href={String(result.consentUrl)} className="text-sky-600 underline">
                {String(result.consentUrl)}
              </Link>
            </p>
          ) : null}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-8">
        <Link href="/">← Back to Lumen</Link>
      </p>
    </main>
  );
}
