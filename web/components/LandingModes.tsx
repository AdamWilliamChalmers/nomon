"use client";

import { useState, type ReactNode } from "react";

type ModeKey = "ghost" | "ambient" | "active" | "guard";

type Mode = {
  key: ModeKey;
  label: string;
  dotClass: string;
  optIn?: boolean;
  desc: ReactNode;
  body: ReactNode;
};

const MODES: Mode[] = [
  {
    key: "ghost",
    label: "Ghost",
    dotClass: "bg-blue",
    desc: (
      <>
        <b>Fully invisible.</b> Nothing appears in-session — you only get the weekly digest.
      </>
    ),
    body: (
      <>
        <div className="bubble">Draft a reply to the landlord about the deposit.</div>
        <p className="nothing">nothing appears — digest on Monday</p>
      </>
    ),
  },
  {
    key: "ambient",
    label: "Ambient",
    dotClass: "bg-green",
    desc: (
      <>
        <b>The default.</b> Subtle inline strips for Loop and Drift beside your messages — never a
        pop-up, never a card.
      </>
    ),
    body: (
      <>
        <div className="bubble">ok use that version</div>
        <div className="strip">
          <span className="who">Nomon</span>
          <span className="dot-i bg-green" />
          <span className="sig sig-green">loop · still with it?</span>
        </div>
      </>
    ),
  },
  {
    key: "active",
    label: "Active",
    dotClass: "bg-amber",
    desc: (
      <>
        <b>Everything on.</b> All five signals, plus reflection cards when it matters.
      </>
    ),
    body: (
      <>
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
      </>
    ),
  },
  {
    key: "guard",
    label: "Guard",
    dotClass: "bg-rose",
    optIn: true,
    desc: (
      <>
        <b>The opt-in fourth mode.</b> Active, plus a brief hold before send when a prompt clearly
        conflicts with a protected goal you wrote. Always bypassable.
      </>
    ),
    body: (
      <>
        <div className="bubble">Write the introduction chapter for me.</div>
        <div className="strip">
          <span className="who">Nomon</span>
          <span className="dot-i bg-rose" />
          <span className="sig sig-rose">mismatch · held before send</span>
        </div>
        <div className="hold-card">
          <h4>Quoting you back</h4>
          <p>
            On 12 June you wrote: <q>I draft every chapter introduction myself.</q> Send anyway, or
            edit first?
          </p>
          <div className="reflect-actions">
            <button type="button" className="chip">
              Send anyway
            </button>
            <button type="button" className="chip chip-solid">
              Edit first
            </button>
          </div>
        </div>
      </>
    ),
  },
];

export default function LandingModes() {
  const [active, setActive] = useState<ModeKey>("ambient");
  const current = MODES.find((m) => m.key === active) ?? MODES[1];

  return (
    <div className="modes-grid">
      <div>
        <div className="dial" role="group" aria-label="Visibility modes">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              data-mode={m.key}
              aria-pressed={m.key === active}
              onClick={() => setActive(m.key)}
            >
              <span className={`dot-i ${m.dotClass}`} />
              {m.label}
              {m.optIn ? <span className="optin">opt-in</span> : null}
            </button>
          ))}
        </div>
        <p className="mode-desc" id="mode-desc">
          {current.desc}
        </p>
        <p className="mode-fine">
          The first three modes never hold you up. Guard is the only one that can pause before send —
          you switch it on yourself, it only acts on goals you wrote, and it is always bypassable.
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
            <span className={`dot-i ${current.dotClass}`} />
            {current.label}
          </span>
        </div>
        <div className="chat-body" id="mode-body" aria-live="polite">
          {current.body}
        </div>
      </div>
    </div>
  );
}
