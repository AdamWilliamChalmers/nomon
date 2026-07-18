"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import "../../landing.css";

type Session = {
  email: string;
  name: string;
  organisation: string;
};

export default function OrgDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/organisations/session")
      .then(async (r) => {
        if (!r.ok) {
          router.replace("/organisations#sign-in");
          return;
        }
        const data = await r.json();
        setSession({
          email: data.email,
          name: data.name,
          organisation: data.organisation,
        });
      })
      .catch(() => router.replace("/organisations#sign-in"))
      .finally(() => setLoading(false));
  }, [router]);

  async function signOut() {
    await fetch("/api/organisations/session", { method: "DELETE" });
    router.push("/organisations");
    router.refresh();
  }

  if (loading || !session) {
    return (
      <div className="lumen-landing org-page">
        <div className="wrap" style={{ padding: "120px 28px", color: "var(--ll-muted)" }}>
          Loading preview…
        </div>
      </div>
    );
  }

  const weekLabel = new Date().toISOString().slice(0, 10);

  return (
    <div className="lumen-landing org-page">
      <nav>
        <div className="wrap nav-inner">
          <div className="nav-left">
            <Link className="nav-brand" href="/" aria-label="Nomon home">
              <span className="wm" style={{ fontSize: 14 }}>
                Nomon
              </span>
            </Link>
            <span className="nav-tagline">{session.organisation}</span>
          </div>
          <div className="nav-links">
            <Link href="/organisations">About</Link>
            <button type="button" className="btn btn-ghost btn-small" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="wrap org-dash">
        <p className="org-eyebrow">Cohort preview · sample data</p>
        <h1>{session.organisation}</h1>
        <p className="lede org-dash-lede">
          Signed in as {session.name} ({session.email}). This is illustrative aggregate data —
          real cohort sync is not connected yet. Nothing here is tied to individual employees.
        </p>

        <div className="org-dash-grid">
          <article className="org-mock-card org-dash-card">
            <p className="org-mock-label">Week of {weekLabel}</p>
            <h3>Programme mirror</h3>
            <div className="org-mock-stats">
              <div>
                <span>24</span>
                <em>active participants</em>
              </div>
              <div>
                <span>61%</span>
                <em>avg engagement</em>
              </div>
              <div>
                <span>38%</span>
                <em>transparency badge</em>
              </div>
            </div>
            <p className="org-mock-insight">
              Depth moments are up week-over-week. Badge use clusters around writing-heavy sessions —
              a natural prompt for your next facilitation circle.
            </p>
          </article>

          <article className="org-mock-card org-dash-card">
            <p className="org-mock-label">Shape mix · sample</p>
            <h3>How the room showed up</h3>
            <ul className="org-shape-list">
              <li>
                <span>Balanced</span>
                <b>32%</b>
              </li>
              <li>
                <span>Thinker</span>
                <b>24%</b>
              </li>
              <li>
                <span>Maker</span>
                <b>18%</b>
              </li>
              <li>
                <span>Explorer</span>
                <b>16%</b>
              </li>
              <li>
                <span>Delegator</span>
                <b>10%</b>
              </li>
            </ul>
            <p className="org-mock-insight">
              Shapes describe collaboration style — not performance. No ranking, no targets.
            </p>
          </article>

          <article className="org-mock-card org-dash-card org-dash-wide">
            <p className="org-mock-label">Facilitation</p>
            <h3>Conversation starters for this week</h3>
            <ul className="org-prompt-list">
              <li>
                Looking at your own AI chats — which one felt most like a collaboration, and why?
              </li>
              <li>
                Where did a lighter model (or a shorter prompt) still get you a good enough answer?
              </li>
              <li>
                When did you disclose AI assistance this week, and when did you choose not to?
              </li>
            </ul>
          </article>
        </div>

        <p className="org-dash-note">
          Want this for a real programme? Email{" "}
          <a href="mailto:hello@nomon-app.com?subject=Nomon%20for%20organisations">
            hello@nomon-app.com
          </a>
          .
        </p>
      </main>
    </div>
  );
}
