import type { Metadata } from "next";
import type { CSSProperties } from "react";
import LandingModes from "@/components/LandingModes";
import "./landing.css";

// Set NEXT_PUBLIC_CHROME_STORE_URL once the extension is published. Until then
// this falls back to the Chrome Web Store homepage so the CTA is never a dead
// "#" link.
const CHROME_STORE_URL =
  process.env.NEXT_PUBLIC_CHROME_STORE_URL || "https://chromewebstore.google.com/";

export const metadata: Metadata = {
  title: "Nomon — AI should sharpen your thinking. Not replace it.",
  description:
    "Nomon is a free browser extension with three modes: Mirror (how you think with AI), Badge (disclose AI use), and Cost (same answer, less spend). A mirror, not a nanny.",
};

export default function HomePage() {
  return (
    <div className="lumen-landing">
      {/* ═══════════ Nav ═══════════ */}
      <nav>
        <div className="wrap nav-inner">
          <div className="nav-left">
            <a className="nav-brand" href="#" aria-label="Nomon home">
              <span className="wm" style={{ fontSize: 14 }}>
                Nomon
              </span>
            </a>
            <span className="nav-tagline">A mirror, not a nanny</span>
          </div>
          <div className="nav-links">
            <a href="#modes">Modes</a>
            <a href="#signals">Signals</a>
            <a href="#evidence">Evidence</a>
            <a href="#sceptical">For the sceptical</a>
            <a href="/organisations">Organisations</a>
            <a
              className="btn btn-primary btn-small"
              href={CHROME_STORE_URL}
              target="_blank"
              rel="noopener"
            >
              Add to Chrome — free
            </a>
          </div>
        </div>
      </nav>

      {/* ═══════════ Hero ═══════════ */}
      <header className="hero wrap">
        <div>
          <AnimMark size={56} />

          <h1>
            AI should sharpen your thinking. <em>Not replace it.</em>
          </h1>

          <p className="lede">
            Nomon is a free browser extension with three modes —{" "}
            <strong>Mirror</strong>, <strong>Badge</strong>, and <strong>Cost</strong> — so you keep
            judgement in the loop, disclose AI use when it matters, and spend less when the ask is
            simple. <strong>A mirror, not a nanny.</strong> It never interrupts, never blocks a
            reply, and never reads what you write.
          </p>

          <div className="hero-ctas">
            <a className="btn btn-primary" href={CHROME_STORE_URL} target="_blank" rel="noopener">
              Add to Chrome — free
            </a>
            <a className="btn btn-ghost" href="#modes">
              See the three modes
            </a>
          </div>

          <p className="hero-fine">
            Works with ChatGPT, Claude, Gemini, Grok, Copilot, Perplexity, Mistral, Meta AI,
            DeepSeek, Qwen, Kimi, MiniMax, HuggingChat and Doubao · Everything stays on your device
          </p>
        </div>

        {/* Demo: the product doing its thing */}
        <div className="chat" aria-label="Example of Nomon in an AI chat">
          <div className="chat-head">
            <div className="chat-head-left">
              <StaticMark size={18} />
              <span>your AI chat</span>
            </div>
            <span className="pill">
              <span className="dot-i bg-amber" />
              Active
            </span>
          </div>
          <div className="chat-body">
            <div className="bubble">
              Should I take the new job or stay where I am? Just tell me what to do.
            </div>
            <div className="strip">
              <span className="who">Nomon</span>
              <span className="dot-i bg-blue" />
              <span className="sig sig-blue">depth · worth thinking first?</span>
            </div>
            <div className="reflect">
              <h4>Worth a beat first</h4>
              <p>
                This is a call only you can weigh. Want 30 seconds to note your own read before the
                answer loads? Still your call.
              </p>
              <div className="reflect-actions">
                <button type="button" className="chip chip-solid">
                  Let me think first
                </button>
                <button type="button" className="chip">
                  Skip — just ask
                </button>
              </div>
            </div>
          </div>
          <div className="chat-note">
            Both paths have real trade-offs. Before I weigh in — what matters most to you right now:
            growth, stability, or the people?
          </div>
        </div>
      </header>

      {/* ═══════════ Plain terms ═══════════ */}
      <div className="terms">
        <div className="wrap terms-inner">
          <div>
            <strong>Never interrupts</strong>Signals appear after you send, never as pop-ups.
          </div>
          <div>
            <strong>Never blocks</strong>The AI&rsquo;s reply always arrives, undelayed.
          </div>
          <div>
            <strong>Never reads content</strong>It sees the shape of a conversation, not the words.
          </div>
          <div>
            <strong>Always dismissible</strong>Ghost mode makes it fully invisible, any time.
          </div>
        </div>
      </div>

      {/* ═══════════ How it works ═══════════ */}
      <section id="how">
        <div className="wrap">
          <h2>Three modes. One quiet instrument.</h2>
          <p className="section-intro">
            Turn each on independently. No score chasing, no streaks, no guilt.
          </p>

          <div className="steps">
            <div className="step">
              <div className="step-visual" aria-hidden="true">
                <div className="strip left" style={{ padding: 0 }}>
                  <span className="who">Nomon</span>
                  <span className="dot-i bg-signal" />
                  <span className="sig">depth · worth thinking first?</span>
                </div>
              </div>
              <p className="step-kicker">Mirror</p>
              <h3>Your thinking, reflected</h3>
              <p>
                Notices when you&rsquo;ve stopped evaluating what the AI gives you — and says so in
                one line under your prompt. Signals stay monochrome; the name carries the meaning.
              </p>
            </div>

            <div className="step">
              <div className="step-visual">
                <div className="badge-chip badge-chip--step">
                  <StaticMark size={14} />
                  Claude · AI-assisted
                </div>
              </div>
              <p className="step-kicker">Badge</p>
              <h3>Disclose how you used AI</h3>
              <p>
                Opt-in labels next to the reply — inferred from clarifying questions, edits, and
                pushback — ready to copy when you need to be transparent.
              </p>
            </div>

            <div className="step">
              <div className="step-visual">
                <div className="cost-coach cost-coach--step" data-level="full">
                  <div className="cost-coach-card">
                    <span className="cost-coach-dot" aria-hidden="true" />
                    <div className="cost-coach-bd">
                      <div className="cost-coach-ln">
                        ≈ <b>1.2k</b> · Instant saves ~<b>$0.04</b>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p className="step-kicker">Cost</p>
              <h3>Same answer, less spend</h3>
              <p>
                On-device token estimates and fit tips beside the composer — lighter when the ask is
                extractive, stronger when the stakes are high. Off until you turn it on.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ Modes ═══════════ */}
      <section id="modes">
        <div className="wrap">
          <h2>Mirror · Badge · Cost</h2>
          <p className="section-intro">
            Click a mode to see what it looks like in chat. Each one is optional after Mirror —
            switch any time from the Nomon pill.
          </p>

          <LandingModes />
        </div>
      </section>

      {/* ═══════════ Across your AIs ═══════════ */}
      <section id="everywhere">
        <div className="wrap">
          <h2>One extension, every chat</h2>
          <p className="section-intro" style={{ marginBottom: 36 }}>
            Your habits with AI aren&rsquo;t per-tool, so Nomon isn&rsquo;t either. Mirror, Badge,
            and Cost work inside the chat interfaces you already use. Switching tools never resets
            the picture.
          </p>
          <ul className="ai-list" aria-label="Supported AI tools">
            <li>ChatGPT</li>
            <li>Claude</li>
            <li>Gemini</li>
            <li>Grok</li>
            <li>Copilot</li>
            <li>Perplexity</li>
            <li>Mistral</li>
            <li>Meta AI</li>
            <li>DeepSeek</li>
            <li>Qwen</li>
            <li>Kimi</li>
            <li>MiniMax</li>
            <li>HuggingChat</li>
            <li>Doubao</li>
          </ul>
        </div>
      </section>

      {/* ═══════════ Signals ═══════════ */}
      <section id="signals">
        <div className="wrap">
          <h2>Inside Mirror: five signals</h2>
          <p className="section-intro">
            One warning light can&rsquo;t mean five different things — so Mirror doesn&rsquo;t use
            one. Each signal has its own name and voice, and reads as quiet monochrome data under
            your message. No colour-coded alarms, no red anywhere.
          </p>

          <div className="signal-row">
            <div className="strip left">
              <span className="who">Nomon</span>
              <span className="dot-i bg-sky" />
              <span className="sig sig-sky">hand-off · what do you already know?</span>
            </div>
            <p className="meaning">
              You&rsquo;ve delegated a whole task in your first message. A gentle prompt to put down
              your own starting point first.
              <span className="lives">An invitation, never a gate.</span>
            </p>
          </div>

          <div className="signal-row">
            <div className="strip left">
              <span className="who">Nomon</span>
              <span className="dot-i bg-green" />
              <span className="sig sig-green">loop · still with it?</span>
            </div>
            <p className="meaning">
              You&rsquo;ve accepted several answers in a row without editing or pushing back.
              In-session, right now.
              <span className="lives">Noticing, not judging.</span>
            </p>
          </div>

          <div className="signal-row">
            <div className="strip left">
              <span className="who">Nomon</span>
              <span className="dot-i bg-amber" />
              <span className="sig sig-amber">drift · fewer questions than last week</span>
            </div>
            <p className="meaning">
              Across sessions, you&rsquo;re asking less and accepting more. A longer-term pattern.
              <span className="lives">Lives in your weekly digest, never as an alarm.</span>
            </p>
          </div>

          <div className="signal-row">
            <div className="strip left">
              <span className="who">Nomon</span>
              <span className="dot-i bg-rose" />
              <span className="sig sig-rose">mismatch · you said you&rsquo;d write this part</span>
            </div>
            <p className="meaning">
              This conflicts with a goal <b>you</b> set. Nomon just quotes your past self back — it
              never decides what you should protect.
              <span className="lives">Only ever fires on goals you wrote yourself.</span>
            </p>
          </div>

          <div className="signal-row">
            <div className="strip left">
              <span className="who">Nomon</span>
              <span className="dot-i bg-blue" />
              <span className="sig sig-blue">depth · worth thinking first?</span>
            </div>
            <p className="meaning">
              A high-stakes question where the thinking is the point. An invitation to a beat before
              the answer loads.
              <span className="lives">The answer still arrives — never delayed.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════ Weekly card ═══════════ */}
      <section id="week">
        <div className="wrap week-grid">
          <div>
            <h2>Your week, in one card</h2>
            <p className="section-intro" style={{ marginBottom: 0 }}>
              Every Mirror signal rolls up into a single, shareable card — your shape, your trends,
              and one question worth sitting with. Shapes, not rankings: there are no raw scores and
              no leaderboard, because the point is comparison with your own last week, not with
              strangers.
            </p>
          </div>

          <div className="wcard">
            <div className="wcard-top">
              <StaticMark size={22} />
              <span className="pill">Share</span>
            </div>
            <h3>This week</h3>
            <p className="shape-label">Explorer · steady</p>
            <p className="summary">
              Mostly research and learning mode. You pushed back a little more than last week.
            </p>
            <div className="wstats">
              <div className="wstat">
                <span>Depth moments</span>
                <b>6</b>
              </div>
              <div className="wstat">
                <span>Questions asked</span>
                <b>41</b>
              </div>
              <div className="wstat">
                <span>Conscious delegates</span>
                <b>12</b>
              </div>
              <div className="wstat">
                <span>Loop breaks</span>
                <b>5</b>
              </div>
            </div>
            <div className="wbar">
              <div className="wbar-label">
                <span>Intentional use</span>
                <span>78%</span>
              </div>
              <div className="wbar-track">
                <div className="wbar-fill fill-win" style={{ width: "78%" }} />
              </div>
            </div>
            <div className="wbar">
              <div className="wbar-label">
                <span>Questions vs commands</span>
                <span>62%</span>
              </div>
              <div className="wbar-track">
                <div className="wbar-fill fill-neutral" style={{ width: "62%" }} />
              </div>
            </div>
            <p className="sit-with">
              One to sit with: what did you figure out yourself this week, without AI?
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════ Evidence ═══════════ */}
      <section id="evidence">
        <div className="wrap">
          <h2>How you use AI matters</h2>
          <p className="section-intro">
            Cognitive science is clear that offloading thinking to AI can blunt skill and knowledge
            — and that staying in the loop changes the outcome. Nomon is built around that
            distinction. A few findings that shaped the product:
          </p>

          <div className="evidence-list">
            <article className="evidence-row">
              <p className="evidence-cite">
                <a
                  href="https://doi.org/10.1073/pnas.2422633122"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Bastani et al. · PNAS · 2025
                </a>
              </p>
              <div>
                <p className="evidence-finding">
                  High-school students with an AI that handed them answers did better in practice —
                  then worse on a test with no AI. Full offloading blocked the practice needed to
                  learn.
                </p>
                <p className="evidence-nomon">
                  In Nomon: Hand-off and Loop notice when the work is leaving your hands.
                </p>
              </div>
            </article>

            <article className="evidence-row">
              <p className="evidence-cite">
                <a
                  href="https://doi.org/10.1093/pnasnexus/pgaf316"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Melumad &amp; Yun · PNAS Nexus · 2025
                </a>
              </p>
              <div>
                <p className="evidence-finding">
                  People who learned via AI summaries spent less time, learned less, and felt less
                  ownership of what they knew than people who searched and synthesised themselves.
                </p>
                <p className="evidence-nomon">
                  In Nomon: Depth invites a beat before high-stakes answers land.
                </p>
              </div>
            </article>

            <article className="evidence-row">
              <p className="evidence-cite">
                <a
                  href="https://doi.org/10.1016/j.tics.2026.06.004"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Cash et al. · Trends in Cognitive Sciences · 2026
                </a>
              </p>
              <div>
                <p className="evidence-finding">
                  Complete offloading can hinder skill acquisition and foster decay — but outcomes
                  depend on how AI is used. Stay in the cognitive loop, and the costs are not
                  inevitable.
                </p>
                <p className="evidence-nomon">
                  In Nomon: Mirror is that loop — a quiet reflection, not a block.
                </p>
              </div>
            </article>
          </div>

          <p className="evidence-fine">
            These studies support the mechanism Nomon is designed around — not a claim that the
            extension itself has been clinically validated.
          </p>
        </div>
      </section>

      {/* ═══════════ For the sceptical ═══════════ */}
      <section id="sceptical">
        <div className="wrap">
          <h2>For the sceptical</h2>
          <p className="section-intro">
            Fair questions, direct answers. Nomon exists to counter cognitive offloading — the
            well-studied habit of leaning on a tool until you stop thinking for yourself. And if a
            tool watches how you use AI, you should be suspicious of it by default. Here&rsquo;s
            exactly where the lines are.
          </p>

          <div className="qa">
            <div className="qa-item">
              <h3>Does it read my conversations?</h3>
              <p>
                <b>No.</b> Nomon reads the shape of a conversation — message length,
                question-versus-command patterns, pace — never the words. Message text is not
                stored, analysed as content, or transmitted.
              </p>
            </div>
            <div className="qa-item">
              <h3>Does anything leave my computer?</h3>
              <p>
                <b>Scoring stays on your device.</b> All signal detection runs locally in your
                browser. Contributing anonymised counts to research is on by default — daily counts
                and feedback snippets only, not full chats — and you can turn it off any time under
                Privacy &amp; data in the pill.
              </p>
            </div>
            <div className="qa-item">
              <h3>Will it nag me?</h3>
              <p>
                <b>It&rsquo;s built not to.</b> Signals are one-line strips under messages
                you&rsquo;ve already sent. No pop-ups, no red, no streaks, no guilt mechanics. If it
                ever feels like a nag, that&rsquo;s a bug in the product, not a feature you have to
                manage.
              </p>
            </div>
            <div className="qa-item">
              <h3>Is this a screen-time app?</h3>
              <p>
                <b>No.</b> Nomon measures <b>how</b> you use AI, not how much. Use AI as often as you
                like — heavy use with your judgement engaged is exactly the point.
              </p>
            </div>
            <div className="qa-item">
              <h3>Can it ever stop me sending a message?</h3>
              <p>
                <b>Only if you ask it to.</b> Inside Mirror, Guard — off by default — briefly holds a
                message that clearly conflicts with a goal you wrote, and even then one click sends
                it anyway. Badge and Cost never touch your messages.
              </p>
            </div>
            <div className="qa-item">
              <h3>What if I just want Mirror gone for a while?</h3>
              <p>
                <b>Ghost mode.</b> One click and Mirror signals disappear in-session — you only get
                the weekly digest. Badge and Cost keep their own toggles. Or Pause everything from
                the pill.
              </p>
            </div>
            <div className="qa-item">
              <h3>Contact</h3>
              <p>
                All feedback can be directed to{" "}
                <a href="mailto:hello@nomon-app.com">hello@nomon-app.com</a>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ Organisations ═══════════ */}
      <section id="organisations">
        <div className="wrap org-landing-teaser">
          <div>
            <p className="step-kicker">For organisations</p>
            <h2>AI literacy for teams — without the surveillance.</h2>
            <p className="section-intro" style={{ marginBottom: 0 }}>
              A cohort mirror for L&amp;D and responsible-AI programmes: aggregate how people think
              with AI, never a feed of what they wrote. Same ethos as the free extension.
            </p>
          </div>
          <div className="org-landing-cta">
            <a className="btn btn-primary" href="/organisations">
              Explore organisations
            </a>
            <p className="hero-fine" style={{ marginTop: 14 }}>
              Early access · lightweight sign-in · sample cohort preview
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════ Closing ═══════════ */}
      <section className="closing">
        <div className="wrap">
          <AnimMark size={88} />
          <h2>Keep judgement in the loop.</h2>
          <p>Mirror · Badge · Cost — free, private, and quiet by design.</p>
          <a className="btn btn-primary" href={CHROME_STORE_URL} target="_blank" rel="noopener">
            Add to Chrome — free
          </a>
        </div>
      </section>

      {/* ═══════════ Footer ═══════════ */}
      <footer>
        <div className="wrap footer-inner">
          <a className="nav-brand" href="#" aria-label="Nomon home">
            <StaticMark size={20} />
            <span className="wm">Nomon</span>
          </a>
          <p className="fine">
            Free extension · Ages 13+ · <a href="/privacy">Privacy</a> ·{" "}
            <a href="#evidence">Evidence</a> · <a href="#signals">How scoring works</a> ·{" "}
            <a href="/organisations">Organisations</a>
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
