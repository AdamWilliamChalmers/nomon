"use client";

import { useState, type ReactNode } from "react";

type ModeKey = "mirror" | "badge";

type Mode = {
  key: ModeKey;
  label: string;
  tag: string;
  desc: ReactNode;
  body: ReactNode;
};

const MODES: Mode[] = [
  {
    key: "mirror",
    label: "Mirror",
    tag: "On by default",
    desc: (
      <>
        <b>Your thinking, reflected.</b> When you stop evaluating what the AI gives you, a one-line
        strip appears under your prompt — never a pop-up, never a block.
      </>
    ),
    body: (
      <>
        <div className="bubble">
          Should I take the new job or stay where I am? Just tell me what to do.
        </div>
        <div className="strip">
          <span className="who">Nomon</span>
          <span className="dot-i bg-signal" />
          <span className="sig">depth · worth thinking first?</span>
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
      </>
    ),
  },
  {
    key: "badge",
    label: "Badge",
    tag: "Opt-in",
    desc: (
      <>
        <b>Disclose how you used AI.</b> Behaviour-inferred labels — AI-assisted, AI-led, and so on —
        sit next to the reply, ready to copy when you need to be transparent.
      </>
    ),
    body: (
      <>
        <div className="bubble bubble-assistant">
          Both paths have real trade-offs. Before I weigh in — what matters most to you right now:
          growth, stability, or the people?
        </div>
        <div className="badge-row">
          <span className="badge-chip">
            <span className="mark" style={{ width: 14, height: 14 }} aria-hidden="true">
              <div className="d d-green" />
              <div className="d d-amber" />
              <div className="d d-rose" />
              <div className="d d-blue" />
            </span>
            Claude · AI-assisted
          </span>
          <span className="badge-meta">Copy disclosure</span>
        </div>
        <p className="mode-preview-note">
          Inferred from how you worked the thread — clarifying questions, edits, pushback — not from
          reading the words.
        </p>
      </>
    ),
  },
];

export default function LandingModes() {
  const [active, setActive] = useState<ModeKey>("mirror");
  const current = MODES.find((m) => m.key === active) ?? MODES[0];

  return (
    <div className="modes-grid">
      <div>
        <div className="dial" role="group" aria-label="Nomon modes">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              data-mode={m.key}
              aria-pressed={m.key === active}
              onClick={() => setActive(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mode-desc" id="mode-desc">
          {current.desc}
        </p>
        <p className="mode-fine">
          Each mode turns on independently. Mirror runs by default; Badge is opt-in. Pause stops
          everything until you resume.
        </p>
      </div>

      <div className="chat mode-preview">
        <div className="chat-head">
          <div className="chat-head-left">
            <div className="mark" style={{ width: 18, height: 18 }} aria-hidden="true">
              <div className="d d-green" />
              <div className="d d-amber" />
              <div className="d d-rose" />
              <div className="d d-blue" />
            </div>
            <span>your AI chat</span>
          </div>
          <span className="pill" id="mode-pill">
            {current.label}
            <span className="pill-tag">{current.tag}</span>
          </span>
        </div>
        <div className="chat-body" id="mode-body" aria-live="polite">
          {current.body}
        </div>
      </div>
    </div>
  );
}
