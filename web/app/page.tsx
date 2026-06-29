import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

// Set NEXT_PUBLIC_CHROME_STORE_URL once the extension is published. Until then
// this falls back to the Chrome Web Store homepage so the CTA is never a dead
// "#" link.
const CHROME_STORE_URL =
  process.env.NEXT_PUBLIC_CHROME_STORE_URL || "https://chromewebstore.google.com/";

const SIGNALS = [
  {
    key: "loop",
    name: "Loop",
    chip: "in-session passivity",
    color: "var(--lm-loop)",
    text: "var(--lm-loop-text)",
    desc: "You've accepted several AI outputs in a row without editing or pushing back. Lumen notices — it doesn't judge.",
  },
  {
    key: "drift",
    name: "Drift",
    chip: "cross-session decline",
    color: "var(--lm-drift)",
    text: "var(--lm-drift-text)",
    desc: "Over multiple sessions, your active engagement with AI output is trending down. A longer-term pattern.",
  },
  {
    key: "mismatch",
    name: "Mismatch",
    chip: "goal conflict",
    color: "var(--lm-mismatch)",
    text: "var(--lm-mismatch-text)",
    desc: "This conversation conflicts with a goal you've set — like \u201cthink independently on strategic questions.\u201d",
  },
  {
    key: "depth",
    name: "Depth",
    chip: "worth thinking first",
    color: "var(--lm-depth)",
    text: "var(--lm-depth-text)",
    desc: "That's a high-stakes question. Lumen gently asks if you want 30 seconds to form your own answer first.",
  },
];

export default function HomePage() {
  return (
    <main className="lm-app-shell">
      {/* Nav */}
      <nav
        className="flex items-center justify-between px-6 md:px-10 py-4 bg-white"
        style={{ borderBottom: "0.5px solid var(--lm-mist)" }}
      >
        <BrandLogo variant="full" height={28} />
        <div className="flex items-center gap-6">
          <a href="#how" className="text-[13px] text-[var(--lm-slate)] hover:text-[var(--lm-dusk)]">
            How it works
          </a>
          <a href="#signals" className="text-[13px] text-[var(--lm-slate)] hover:text-[var(--lm-dusk)]">
            Signals
          </a>
          <Link href="/upgrade" className="text-[13px] text-[var(--lm-slate)] hover:text-[var(--lm-dusk)]">
            Pro
          </Link>
          <a href={CHROME_STORE_URL} target="_blank" rel="noopener" className="lm-landing-cta">
            Add to Chrome — free
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="lm-hero px-6 md:px-10 pt-20 pb-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="lm-eyebrow mb-5">
            <span className="lm-eyebrow-dot" />
            Cognitive mirror for AI users
          </div>
          <h1 className="lm-landing-h1 mb-5">
            AI should sharpen your thinking, not <em>replace</em> it.
          </h1>
          <p className="lm-landing-subhead mb-8 max-w-lg mx-auto">
            Lumen watches how you use AI — passivity, drift, goal conflicts — and quietly holds
            up a mirror. No nannying. No red alerts. Just signal.
          </p>
          <div className="flex justify-center gap-3 mb-12 flex-wrap">
            <a href={CHROME_STORE_URL} target="_blank" rel="noopener" className="lm-landing-cta">
              Add to Chrome — free
            </a>
            <a href="#how" className="lm-btn">
              See how it works
            </a>
          </div>
          <div className="flex justify-center gap-2 flex-wrap">
            {SIGNALS.map((s) => (
              <div key={s.key} className="lm-sig-chip">
                <span className="lm-sig-chip-dot" style={{ background: s.color }} />
                <span className="lm-sig-chip-name">{s.name}</span>
                <span className="lm-sig-chip-desc">{s.chip}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mirror / not nanny strip */}
      <div
        className="bg-white px-6 md:px-10 py-4 flex items-center justify-center gap-8 flex-wrap text-center"
        style={{ borderTop: "0.5px solid var(--lm-mist)", borderBottom: "0.5px solid var(--lm-mist)" }}
      >
        {[
          ["Mirror, not nanny", "no red, no blocked responses"],
          ["Ghost mode", "go invisible any time"],
          ["Weekly digest", "longitudinal patterns over time"],
        ].map(([strong, rest]) => (
          <div key={strong} className="text-[12px] text-[var(--lm-haze)]">
            <strong className="text-[var(--lm-dusk)] font-semibold">{strong}</strong> — {rest}
          </div>
        ))}
      </div>

      {/* How it works */}
      <section id="how" className="lm-how-section max-w-4xl mx-auto px-6 py-20">
        <h2 className="lm-how-title text-center mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Step
            n={1}
            title="Extension watches"
            body="Inline signals appear under your messages as you chat."
          />
          <Step
            n={2}
            title="You see when you've stopped evaluating"
            body="Loop, drift, mismatch, and depth — never blocking, never judging."
          />
          <Step
            n={3}
            title="Your weekly card shows your pattern"
            body="Your shape and trends live on lumen.so — shareable, no scores exposed."
          />
        </div>
      </section>

      {/* The four signals */}
      <section id="signals" className="max-w-5xl mx-auto px-6 pb-20">
        <div className="lm-label text-center mb-6">The four signals</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SIGNALS.map((s) => (
            <div key={s.key} className="lm-signal-explain">
              <span
                className="lm-sig-chip-dot"
                style={{ background: s.color, display: "inline-block", marginBottom: 10 }}
              />
              <div className="lm-signal-explain__name" style={{ color: s.text }}>
                {s.name}
              </div>
              <div className="lm-signal-explain__desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="lm-divider max-w-4xl mx-auto" />

      {/* Families */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="lm-page-title text-center mb-4">For families</h2>
        <p className="text-center text-[14px] text-[var(--lm-slate)] mb-4 max-w-xl mx-auto leading-relaxed">
          Instead of trying to stop your teenager using AI, help them use it well. Your child shares
          their weekly card with you by choice — never your messages, never surveillance.
        </p>
        <p className="text-center text-[12px] text-[var(--lm-haze)] mb-8">
          Self-awareness lasts. Compliance doesn&apos;t.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Link href="/signup" className="lm-btn lm-btn-primary">
            Create account (13+)
          </Link>
          <Link href="/family/parent" className="lm-btn">
            Parent view
          </Link>
        </div>
      </section>

      <div className="lm-divider max-w-4xl mx-auto" />

      {/* Community */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="lm-page-title text-center mb-4">Community</h2>
        <p className="text-center text-[14px] text-[var(--lm-slate)] mb-8">
          Shapes, not rankings. Sample cards from people who opted in.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          {[
            { shape: "Explorer", color: "var(--lm-depth)" },
            { shape: "Thinker", color: "var(--lm-mismatch)" },
            { shape: "Maker", color: "var(--lm-loop)" },
          ].map(({ shape, color }) => (
            <div key={shape} className="lm-surface p-4 w-36 text-center">
              <BrandLogo variant="icon" height={18} className="mx-auto mb-2" />
              <p className="text-[12px] font-semibold" style={{ color }}>
                {shape}
              </p>
            </div>
          ))}
        </div>
        <p className="text-center mt-8">
          <Link href="/community" className="lm-link text-[13px]">
            See community feed →
          </Link>
        </p>
      </section>

      <div className="lm-divider max-w-4xl mx-auto" />

      {/* Pricing */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-0">
          <div className="md:pr-10 pb-10 md:pb-0">
            <h3 className="text-[17px] font-semibold text-[var(--lm-dusk)] mb-6 tracking-[-0.01em]">
              Free
            </h3>
            <ul className="space-y-3 text-[14px] text-[var(--lm-slate)] mb-8">
              <li>Detects when you shift from thinking with AI to accepting from AI</li>
              <li>Four signals — each targeting a different metacognitive risk</li>
              <li>Exemption learning</li>
              <li>Session badge + popup</li>
            </ul>
            <a href={CHROME_STORE_URL} target="_blank" rel="noopener" className="lm-link text-[13px]">
              Install free →
            </a>
            <p className="text-[12px] text-[var(--lm-haze)] mt-2">Chrome Web Store</p>
          </div>
          <div
            className="md:pl-10 pt-10 md:pt-0 md:border-l"
            style={{ borderColor: "var(--lm-mist)" }}
          >
            <h3 className="text-[17px] font-semibold text-[var(--lm-dusk)] mb-1 tracking-[-0.01em]">
              Pro — <span className="text-[var(--lm-mismatch)]">£49 once</span>
            </h3>
            <p className="text-[13px] text-[var(--lm-slate)] mb-6">Everything in Free, plus:</p>
            <ul className="space-y-3 text-[14px] text-[var(--lm-slate)] mb-8">
              <li>Weekly card + history</li>
              <li>Shareable card URL</li>
              <li>Weekly digest email</li>
              <li>Community feed</li>
              <li>Self-comparison</li>
            </ul>
            <Link href="/upgrade" className="lm-link text-[13px]">
              Unlock Pro →
            </Link>
            <p className="text-[12px] text-[var(--lm-haze)] mt-2">One-time · No subscription</p>
          </div>
        </div>
      </section>

      <footer
        className="text-center py-10 text-[12px] text-[var(--lm-haze)]"
        style={{ borderTop: "0.5px solid var(--lm-mist)" }}
      >
        Free extension · Pro £49 one-time · Ages 13+
      </footer>
    </main>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="text-center">
      <div className="lm-step-ring">{n}</div>
      <h3 className="lm-step-title">{title}</h3>
      <p className="lm-step-body">{body}</p>
    </div>
  );
}
