import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import OrgSignInForm from "@/components/OrgSignInForm";
import { getOrgSession } from "@/lib/org-session";
import "../landing.css";

export const metadata: Metadata = {
  title: "Nomon for organisations — a mirror for AI literacy, not surveillance",
  description:
    "Aggregate, consent-led insights into how your people think with AI. Coach programmes, not monitor employees.",
};

export default function OrganisationsPage() {
  const session = getOrgSession();

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
            <span className="nav-tagline">For organisations</span>
          </div>
          <div className="nav-links">
            <a href="#why">Why</a>
            <a href="#principles">Principles</a>
            <a href="#preview">Preview</a>
            {session ? (
              <Link className="btn btn-primary btn-small" href="/organisations/dashboard">
                Open preview
              </Link>
            ) : (
              <a className="btn btn-primary btn-small" href="#sign-in">
                Sign in
              </a>
            )}
          </div>
        </div>
      </nav>

      <header className="hero wrap org-hero">
        <div>
          <AnimMark size={48} />
          <p className="org-eyebrow">Early access</p>
          <h1>
            AI literacy for teams. <em>Without the surveillance.</em>
          </h1>
          <p className="lede">
            Nomon for organisations is a cohort mirror for L&amp;D and responsible-AI programmes —
            aggregate trends in how people think with AI, never a feed of what they wrote. Same
            ethos as the free extension: <strong>a mirror, not a nanny.</strong>
          </p>
          <div className="hero-ctas">
            {session ? (
              <Link className="btn btn-primary" href="/organisations/dashboard">
                Continue as {session.organisation}
              </Link>
            ) : (
              <a className="btn btn-primary" href="#sign-in">
                Sign in — see the preview
              </a>
            )}
            <Link className="btn btn-ghost" href="/">
              Back to Nomon
            </Link>
          </div>
          <p className="hero-fine">
            Individuals stay free forever · No prompts · No rankings · Consent to join a cohort
          </p>
        </div>

        <aside className="org-sign-card" aria-label="Organisation sign-in">
          <h2>Lightweight sign-in</h2>
          <p>
            Email and organisation name only. Opens a sample cohort card so you can feel the
            product — real cohorts aren&rsquo;t wired yet.
          </p>
          {session ? (
            <div className="org-signed">
              <p>
                Signed in as <strong>{session.name}</strong>
                <br />
                <span className="org-muted">{session.organisation}</span>
              </p>
              <Link className="btn btn-primary" href="/organisations/dashboard">
                Open cohort preview
              </Link>
            </div>
          ) : (
            <OrgSignInForm />
          )}
        </aside>
      </header>

      <section id="why">
        <div className="wrap">
          <h2>Built for programmes, not performance reviews</h2>
          <p className="section-intro">
            Companies notice skill atrophy in AI-heavy work. L&amp;D can teach tools — but not see
            whether people are still thinking. Nomon measures engagement quality in aggregate, so
            facilitators can coach the room, not watch individuals.
          </p>
          <div className="org-pillars">
            <div>
              <p className="step-kicker">See</p>
              <h3>How the group thinks with AI</h3>
              <p>
                Engagement, depth moments, transparency badge rate — rolled up for the cohort, never
                listed by name.
              </p>
            </div>
            <div>
              <p className="step-kicker">Coach</p>
              <h3>Run a reflection session</h3>
              <p>
                A weekly group card plus conversation prompts — the same spirit as Nomon&rsquo;s
                personal digest, scaled to a workshop.
              </p>
            </div>
            <div>
              <p className="step-kicker">Protect</p>
              <h3>Privacy as the product</h3>
              <p>
                No keystrokes, screenshots, or conversation content. Participants join explicitly
                and can leave. Admins never see individuals.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="principles">
        <div className="wrap">
          <h2>Hard lines</h2>
          <div className="terms">
            <div className="terms-inner org-terms">
              <div>
                <strong>No individual views</strong>Aggregates only — no employee drill-down.
              </div>
              <div>
                <strong>No content</strong>Prompts and replies never leave the person&rsquo;s
                device for the org product.
              </div>
              <div>
                <strong>No rankings</strong>No leaderboards, maturity grades, or &ldquo;worst
                team&rdquo; lists.
              </div>
              <div>
                <strong>Consent to join</strong>People opt into a cohort. Revoke anytime.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="preview">
        <div className="wrap org-preview-grid">
          <div>
            <h2>What you&rsquo;d actually see</h2>
            <p className="section-intro" style={{ marginBottom: 0 }}>
              A quiet cohort card — shape mix, engagement trend, transparency practice. Cost and
              platform mix come later, and only as secondary context. Sign in above to open the
              interactive preview.
            </p>
          </div>
          <div className="org-mock-card" aria-hidden="true">
            <p className="org-mock-label">Sample cohort · week of preview</p>
            <h3>Acme · AI literacy programme</h3>
            <div className="org-mock-stats">
              <div>
                <span>24</span>
                <em>active this week</em>
              </div>
              <div>
                <span>61%</span>
                <em>avg engagement</em>
              </div>
              <div>
                <span>38%</span>
                <em>badge used</em>
              </div>
            </div>
            <p className="org-mock-insight">
              Depth moments rose vs last week. Transparency is strongest in the writing-heavy
              sessions — good material for the next workshop.
            </p>
          </div>
        </div>
      </section>

      <section className="closing">
        <div className="wrap">
          <AnimMark size={72} />
          <h2>Keep judgement in the organisation.</h2>
          <p>Extension free for everyone. Org preview is early — tell us what you need.</p>
          <a className="btn btn-primary" href="#sign-in">
            Sign in to the preview
          </a>
        </div>
      </section>

      <footer>
        <div className="wrap footer-inner">
          <Link className="nav-brand" href="/" aria-label="Nomon home">
            <StaticMark size={20} />
            <span className="wm">Nomon</span>
          </Link>
          <p className="fine">
            Free extension ·{" "}
            <a href="mailto:hello@nomon-app.com">hello@nomon-app.com</a> ·{" "}
            <Link href="/privacy">Privacy</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

function StaticMark({ size }: { size: number }) {
  return (
    <div className="mark" style={{ width: size, height: size }} aria-hidden="true">
      <div className="d d-green" />
      <div className="d d-amber" />
      <div className="d d-rose" />
      <div className="d d-blue" />
    </div>
  );
}

const ANIM_DOTS = [
  { cls: "d-green", rx: -0.375, ry: -0.2, ex: 0, ey: -0.357 },
  { cls: "d-amber", rx: 0, ry: -0.2, ex: 0.357, ey: 0 },
  { cls: "d-rose", rx: 0.375, ry: -0.2, ex: 0, ey: 0.357 },
  { cls: "d-blue", rx: 0, ry: 0.17, ex: -0.357, ey: 0 },
] as const;

function AnimMark({ size }: { size: number }) {
  const dot = Math.round(size * 0.25);
  const half = dot / 2;
  return (
    <div
      className="mark-anim"
      style={{ width: size, height: size }}
      role="img"
      aria-label="Nomon mark"
    >
      <div className="spin">
        {ANIM_DOTS.map((d) => (
          <div
            key={d.cls}
            className={`d ${d.cls}`}
            style={
              {
                width: dot,
                height: dot,
                margin: `${-half}px 0 0 ${-half}px`,
                "--rx": `${Math.round(d.rx * size)}px`,
                "--ry": `${Math.round(d.ry * size)}px`,
                "--ex": `${Math.round(d.ex * size)}px`,
                "--ey": `${Math.round(d.ey * size)}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
