import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import LumenMark from "@/components/LumenMark";

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
    strip: "loop \u00b7 still with it?",
    desc: "You've accepted several answers in a row without editing or pushing back. In-session, right now \u2014 noticing, not judging.",
  },
  {
    key: "drift",
    name: "Drift",
    chip: "cross-session decline",
    color: "var(--lm-drift)",
    strip: "drift \u00b7 fewer questions than last week",
    desc: "Across sessions you're asking less and accepting more. A longer-term pattern \u2014 it lives in your weekly digest, never as an alarm.",
  },
  {
    key: "mismatch",
    name: "Mismatch",
    chip: "goal conflict",
    color: "var(--lm-mismatch)",
    strip: "mismatch \u00b7 you said you'd write this part",
    desc: "This conflicts with a goal you set for yourself. Lumen just quotes your past self back \u2014 it never decides what you should protect.",
  },
  {
    key: "depth",
    name: "Depth",
    chip: "worth thinking first",
    color: "var(--lm-depth)",
    strip: "depth \u00b7 worth thinking first?",
    desc: "A high-stakes question where the thinking is the point. An invitation to a beat before the answer loads \u2014 never a gate.",
  },
];

const MODES = [
  { name: "Ambient", desc: "Subtle inline cues beside your messages — never a pop-up. The default." },
  { name: "Ghost", desc: "Nothing in-session — you only get the weekly digest." },
  { name: "Active", desc: "Inline cues plus reflection cards when it matters." },
  { name: "Focus", desc: "Active, plus a goal you declare for the session." },
  {
    name: "Guard",
    desc: "Optional fifth mode: Active, plus a brief hold before send when a prompt clearly conflicts with a protected goal you wrote. Always bypassable.",
    optIn: true as const,
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
          <a href={CHROME_STORE_URL} target="_blank" rel="noopener" className="lm-landing-cta">
            Add to Chrome — free
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="lm-hero px-6 md:px-10 pt-16 md:pt-20 pb-20">
        <div className="lm-hero-grid max-w-6xl mx-auto">
          {/* Copy */}
          <div>
            <LumenMark size={44} animate="loop" className="mb-7" />
            <h1 className="lm-landing-h1 mb-5">
              AI should sharpen your thinking.
              <br />
              Not replace it.
            </h1>
            <p className="lm-landing-subhead mb-7 max-w-md">
              Lumen sits quietly beneath your AI chats and reflects how you&apos;re using them —
              passivity, drift, goal conflicts. A mirror, not a nanny. No red, no nagging, and no
              blocked replies unless you opt into Guard.
            </p>
            <div className="flex gap-3 mb-7 flex-wrap">
              <a href={CHROME_STORE_URL} target="_blank" rel="noopener" className="lm-landing-cta">
                Add to Chrome — free
              </a>
              <a href="#how" className="lm-btn">
                See how it works
              </a>
            </div>
            <p className="lm-hero-trust">Free · ChatGPT, Claude &amp; Gemini · Ghost mode any time</p>
          </div>

          {/* Live product demo */}
          <ChatDemo />
        </div>
      </section>

      {/* Mirror / not nanny strip */}
      <div
        className="bg-white px-6 md:px-10 py-4 flex items-center justify-center gap-8 flex-wrap text-center"
        style={{ borderTop: "0.5px solid var(--lm-mist)", borderBottom: "0.5px solid var(--lm-mist)" }}
      >
        {[
          ["Mirror, not nanny", "no red, no nagging by default"],
          ["Ghost mode", "go invisible any time"],
          ["Guard mode", "optional hold before send — you opt in"],
          ["Weekly digest", "longitudinal patterns over time"],
        ].map(([strong, rest]) => (
          <div key={strong} className="text-[12px] text-[var(--lm-haze)]">
            <strong className="text-[var(--lm-dusk)] font-semibold">{strong}</strong> — {rest}
          </div>
        ))}
      </div>

      {/* How it works */}
      <section id="how" className="lm-how-section max-w-5xl mx-auto px-6 py-20">
        <h2 className="lm-how-title mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-10 md:gap-12">
          <Step
            n={1}
            title="It watches the conversation"
            body="A lightweight extension reads how you and the AI are talking — never your content, never sent anywhere."
          />
          <Step
            n={2}
            title="It reflects, inline"
            body="When you stop evaluating, a quiet line appears under your message. One of four signals. Never a banner, never a block."
          />
          <Step
            n={3}
            title="It adds up over the week"
            body="Your patterns become a single shareable card — your shape and trends, no raw scores exposed."
          />
        </div>
      </section>

      {/* The four signals — shown as the real strip lines */}
      <section id="signals" className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="lm-how-title mb-2">Four signals, four meanings</h2>
        <p className="text-[14px] text-[var(--lm-slate)] mb-8 max-w-xl leading-relaxed">
          One red light can&apos;t mean four different things. So Lumen doesn&apos;t use one. Each
          signal has its own name, colour and voice — and reads as quiet data, exactly as it appears
          under your message.
        </p>
        <div>
          {SIGNALS.map((s) => (
            <div key={s.key} className="lm-sig-row">
              <div className="lm-sig-row__strip">
                <span className="lm-strip-word">Lumen</span>
                <span className="lm-strip-dot" style={{ background: s.color }} />
                <span className="lm-sig-row__msg" style={{ color: s.color }}>
                  {s.strip}
                </span>
              </div>
              <p className="lm-sig-row__desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="lm-divider max-w-5xl mx-auto" />

      {/* Weekly card */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="lm-hero-grid">
          <div>
            <h2 className="lm-how-title mb-3">Your week, in one card</h2>
            <p className="lm-landing-subhead mb-6 max-w-md text-[15px]">
              Every signal rolls up into a single, shareable card — your shape, your trends, and one
              question worth sitting with. No raw scores. No leaderboard.
            </p>
          </div>
          <WeeklyCardMock />
        </div>
      </section>

      <div className="lm-divider max-w-5xl mx-auto" />

      {/* Modes — how present Lumen is */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="lm-how-title mb-2">You choose how present it is</h2>
        <p className="text-[14px] text-[var(--lm-slate)] mb-8 max-w-lg leading-relaxed">
          Five modes, one dial — switchable any time from the pill. The first four never block you;
          Guard is the optional fifth for when you want Lumen to hold the line on goals you wrote.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODES.map((m) => (
            <div
              key={m.name}
              className={`lm-surface p-4 flex gap-3 items-baseline${"optIn" in m && m.optIn ? " sm:col-span-2" : ""}`}
            >
              <span className="text-[13px] font-semibold text-[var(--lm-dusk)] min-w-[58px]">
                {m.name}
                {"optIn" in m && m.optIn ? (
                  <span className="block text-[10px] font-medium text-[var(--lm-mismatch)] mt-0.5">
                    opt-in
                  </span>
                ) : null}
              </span>
              <span className="text-[13px] text-[var(--lm-slate)] leading-relaxed">{m.desc}</span>
            </div>
          ))}
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
          {["Explorer", "Thinker", "Maker"].map((shape) => (
            <div key={shape} className="lm-surface p-4 w-36 text-center">
              <BrandLogo variant="icon" height={18} className="mx-auto mb-2" />
              <p className="text-[12px] font-semibold text-[var(--lm-dusk)]">{shape}</p>
            </div>
          ))}
        </div>
        <p className="text-center mt-8">
          <Link href="/community" className="lm-link text-[13px]">
            See community feed →
          </Link>
        </p>
      </section>

      <footer
        className="text-center py-10 text-[12px] text-[var(--lm-haze)]"
        style={{ borderTop: "0.5px solid var(--lm-mist)" }}
      >
        Free extension · Ages 13+
      </footer>
    </main>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div>
      <div className="lm-step-index">{String(n).padStart(2, "0")}</div>
      <h3 className="lm-step-title">{title}</h3>
      <p className="lm-step-body">{body}</p>
    </div>
  );
}

function ChatDemo() {
  return (
    <div className="lm-demo" aria-hidden="true">
      <div className="lm-demo-head">
        <BrandLogo variant="icon" height={16} />
        <span className="lm-demo-title">your AI chat</span>
        <span className="lm-demo-mode">ambient</span>
      </div>

      <div className="lm-msg-user">
        Should I take the new job or stay where I am? Just tell me what to do.
      </div>

      <div className="lm-strip">
        <span className="lm-strip-word">Lumen</span>
        <span className="lm-strip-dot" style={{ background: "var(--lm-depth)" }} />
        <span className="lm-strip-msg" style={{ color: "var(--lm-depth)" }}>
          depth · worth thinking first?
        </span>
      </div>

      <div className="lm-nudge">
        <span className="lm-nudge-bar" style={{ background: "var(--lm-depth)" }} />
        <div>
          <div className="lm-nudge-title">Worth a beat first</div>
          <div className="lm-nudge-text">
            This is a call only you can weigh. Want 30 seconds to note your own read before the
            answer loads? Still your call.
          </div>
          <div className="lm-nudge-actions">
            <button type="button" className="lm-nudge-btn lm-nudge-btn--primary">
              Let me think first
            </button>
            <button type="button" className="lm-nudge-btn">
              Skip — just ask
            </button>
          </div>
        </div>
      </div>

      <div className="lm-msg-ai">
        Both paths have real trade-offs. Before I weigh in — what matters most to you right now:
        growth, stability, or the people
        <span className="lm-msg-ai__caret" />
      </div>
    </div>
  );
}

function WeeklyCardMock() {
  const stats = [
    ["Depth moments", "6"],
    ["Questions asked", "41"],
    ["Conscious delegates", "12"],
    ["Loop breaks", "5"],
  ];
  const bars = [
    ["Intentional use", 78, "var(--lm-loop)"],
    ["Questions vs commands", 62, "var(--lm-depth)"],
  ] as const;

  return (
    <div className="lm-weekly-card mx-auto" style={{ maxWidth: 340 }} aria-hidden="true">
      <div className="flex justify-between items-start mb-4">
        <div>
          <BrandLogo variant="icon" height={14} className="mb-1" />
          <h3 className="text-[15px] font-semibold text-[var(--lm-dusk)] mt-1">This week</h3>
          <p className="text-[12px] text-[var(--lm-slate)] mt-0.5">Explorer · steady</p>
        </div>
        <div
          className="lm-shape-badge"
          style={{ background: "var(--lm-depth-tint)", color: "var(--lm-depth-text)" }}
        >
          Exp
        </div>
      </div>

      <p className="text-[12px] text-[var(--lm-slate)] mb-4 leading-relaxed">
        Mostly research and learning mode. You pushed back a little more than last week.
      </p>

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="rounded-[8px] p-3"
            style={{ background: "var(--lm-mist-lt)", border: "0.5px solid var(--lm-border)" }}
          >
            <p className="lm-label mb-1">{label}</p>
            <p className="text-[15px] font-semibold text-[var(--lm-dusk)]">{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3 mb-4">
        {bars.map(([label, value, color]) => (
          <div key={label}>
            <div className="flex justify-between text-[10px] text-[var(--lm-slate)] mb-1">
              <span>{label}</span>
              <span>{value}%</span>
            </div>
            <div className="lm-bar-track">
              <div className="lm-bar-fill" style={{ width: `${value}%`, background: color }} />
            </div>
          </div>
        ))}
      </div>

      <p className="text-[12px] text-[var(--lm-slate)] leading-relaxed">
        One to sit with: what did you figure out yourself this week, without AI?
      </p>
    </div>
  );
}
