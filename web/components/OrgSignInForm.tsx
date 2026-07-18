"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function OrgSignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/organisations/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, organisation }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not sign in");
        return;
      }
      router.push("/organisations/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="org-form" onSubmit={onSubmit} id="sign-in">
      <label>
        Work email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />
      </label>
      <label>
        Your name
        <input
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Optional"
        />
      </label>
      <label>
        Organisation
        <input
          type="text"
          required
          autoComplete="organization"
          value={organisation}
          onChange={(e) => setOrganisation(e.target.value)}
          placeholder="Acme Ltd"
        />
      </label>
      {error ? <p className="org-form-error">{error}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Signing in…" : "View the cohort preview"}
      </button>
      <p className="org-form-fine">
        No password. No Supabase. A lightweight cookie session so you can look around — we&rsquo;ll
        email you only if you ask.
      </p>
    </form>
  );
}
