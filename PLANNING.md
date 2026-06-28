# Lumen — Planning Overview

> Anchor doc for the current remediation effort. Source of truth for *what* we're
> fixing, *why*, and *acceptance criteria*. Each item links the objective
> ("combat cognitive offloading; be seamless, intuitive, smart, helpful") to a
> concrete defect found in the shipped code (root `manifest.json` build).

## Objective recap

Lumen's job: detect when a user **stops evaluating** AI output and invite them
back into active thinking — **without nagging**. The product must be:

| Quality   | Operational meaning                                        |
|-----------|------------------------------------------------------------|
| Seamless  | Never blocks/hides the AI response; never gates the user.  |
| Intuitive | The score and signals are unambiguous and non-judgmental.  |
| Smart     | Accurate signals, low false positives, works in prod.      |
| Helpful   | Produces real reflection; reaches the user where they are. |

Non-negotiables (from `lumen_v3_design.md` §"Design principles"): No red · Ghost
mode always available · Mismatch only from user goals · **Depth never delays the
AI response** · Drift never a banner/card · reflection box never required.

---

## Status legend
`[ ]` todo · `[~]` in progress · `[x]` done

---

## P0 — Correctness & Trust (this session)

### P0.1 — Inverted badge score `[ ]`
**Defect.** In `engine.js`, a **high** loop score = more passive/offloading
(worse). `sessionScore` is the mean of loop scores, so high = worse. But the
badge tooltip (`widget.js` `updateBadge`) says *"lower means more passive
acceptance"* — the reverse — and the colour mapping shows **green for both high
and low** scores (blue only mid-range). The headline metric is semantically
inverted and visually ambiguous.
**Fix.** Display an **Engagement score = 100 − sessionScore** so higher = better
(matches intuition). Colour: green = high engagement, amber = low. Update tooltip
to match. Keep raw passive score internal.
**Acceptance.** Badge shows higher number for more engaged sessions; colour and
tooltip agree; sparkline colours match the same direction.

### P0.2 — Depth/handoff hide the AI response `[ ]`
**Defect.** `keepAssistantHidden` applies `lumen-ai-hidden` (`display:none`) to
the assistant turn for handoff, loop, and Depth overlays/cards. This contradicts
the non-negotiable "Depth never delays AI response" and the "don't nag" mandate
(the #1 churn risk per the strategic memo).
**Fix.** Make Depth fully additive — render the card, never hide the answer.
Keep the heavier "reconsider" overlay only for explicit delegation (handoff /
high loop) and never auto-fire it on messages #1–2 by hiding output; prefer a
non-blocking strip + card there too, with the overlay as an opt-in expansion.
**Acceptance.** Depth never adds `lumen-ai-hidden`. No signal hides the AI
response on the first two messages. Ghost mode unaffected.

### P0.3 — Tests cover the wrong (unshipped) engine `[ ]`
**Defect.** `scripts/smoke-test-engine.mjs` loads `extension/engine.js` +
`extension/nudges.js` — a divergent API that is **not** what `manifest.json`
ships. The shipped root `engine.js` has zero test coverage.
**Fix.** New `scripts/smoke-test-shipped.mjs` that loads root
`rules.js` → `nudges.js` → `engine.js` (+ stubs for `LumenGoals`/`LumenSession`/
`window`) and asserts the documented false-positive cases from
`lumen_signal_validation.md` (summarise-long-doc, fix-line-42, rapid research,
"write my essay" delegation, passive "thanks continue").
**Acceptance.** `node scripts/smoke-test-shipped.mjs` runs the shipped engine and
passes; known false positives stay below threshold.

### P0.4 — "Four signals" is actually five `[ ]`
**Defect.** `handoff` is a first-class signal in code (label, overlay, strip,
`handoffCount`) but docs/manifest say "four signals."
**Fix.** Document handoff as a first-class signal (it's the early-message
delegation invitation). Update `manifest.json` description and `README.md` signal
table to name all five (or explicitly frame handoff as Loop's first-message
variant). Choose: **name it explicitly.**
**Acceptance.** Manifest + README enumerate handoff; no "four signals" claim that
contradicts the code.

---

## P1 — Make "smart" work in production (next)

### P1.1 — Hardcoded `localhost:3000` backend `[x]`
Done: **Backend URL** input in the popover bound to `webAppUrl`; judge endpoint
derived from the base (`judge.js`, single source); calibration link + judge hint
reflect it. Calls already degrade via try/catch when offline. _Remaining:_ add a
real production host to `host_permissions` once it exists.

### P1.2 — Synthesised timestamps `[x]`
Done: historical bulk messages stay `null` (engine skips velocity/dwell when a
timestamp is absent rather than inventing one); live messages use the real send
moment captured from the composer (`bindSendCapture`, `content.js`). Removed the
`|| Date.now()` re-stamp that re-faked time / marked old messages "fresh."

### P1.3 — Two divergent codebases `[x]`
Done (non-destructive): `extension/README.md` carries a DEPRECATED banner
pointing to the root build + `smoke-test-shipped.mjs`. _Remaining:_ physically
delete `extension/` after porting anything still wanted.

---

## P2 — Reach & efficacy

### P2.1 — Network egress without explicit consent `[x]`
Done: new `shareAnonymisedData` goal (default **false**); `postSessionSummary`
bails unless enabled; popover toggle added. Scoring is fully local by default.

### P2.2 — Multi-platform adapters `[x]`
Done: shared adapter factory (`adapters/base.js`) for no-role-attribute sites
(DOM-order `buildMessageList`), with **Claude**, **Gemini**, and **Grok** as thin
configs; ChatGPT keeps its bespoke role-attribute adapter. Grok is path-scoped to
`x.com/i/grok` (stays off the rest of x.com). Adapter selection via a registry in
`content.js`; manifest matches + loads all five. `smoke-test-adapters.mjs` (62
checks) covers host matching, path-scoping, no-overlap, interface conformance,
and manifest wiring/order. _Note:_ Gemini/Grok selectors are best-effort and may
need live tuning; the fail-soft DOM guard (P3.2) prevents breakage meanwhile.

### P2.3 — Measure nudge efficacy `[x]`
Done: `LumenNudges.summariseResponses(digestLog)` aggregates the concrete
responses already logged (drafted / reflected / paused vs skipped / bypassed)
into an engagement rate, surfaced as a "Your responses" line in the digest
(`nudges.js`, `widget.js`); unit-tested in `smoke-test-shipped.mjs`.

---

## P3 — Polish

- **P3.1** `[x]` `renderSparkline` de-duplicated — `widget.js` delegates to the
  single implementation in `sparkline.js`.
- **P3.2** `[x]` Adapter resilience: interface-conformance test for all adapters
  + defensive try/catch around `buildMessageList` (fail-soft on DOM breaks,
  one-time warning) in `content.js`.

---

## Change log
- _(this session)_ Created planning doc.
- **P0.1 done** — badge now shows Engagement (`100 − passive`), higher = better;
  colour + tooltip + sparkline aligned (`widget.js`, `sparkline.js`).
- **P0.2 done** — overlays are active/focus-only (ambient = strips only, matching
  spec); hand-off and Depth never gate; Depth card no longer hides the AI
  response; judge no longer routes hand-off to the overlay (`engine.js`,
  `widget.js`, `judge.js`). _Decision:_ kept the Loop reconsider overlay for
  Active/Focus + sustained passivity (the one justified pattern-interrupt).
- **P0.3 done** — `scripts/smoke-test-shipped.mjs` exercises the real root engine
  (7 cases incl. FP guards + seamless guarantees); all green.
- **P0.4 done** — hand-off documented as a first-class signal in `manifest.json`
  and `README.md`.
- **P1.1 done** — configurable Backend URL in popover; judge endpoint derived
  from base (`widget.js`, `judge.js`).
- **P1.2 done** — accurate timestamps: historical = null, live = real send time
  via composer capture (`content.js`).
- **P1.3 done** — `extension/` marked DEPRECATED (`extension/README.md`).
- **P2.1 done** — egress gated behind `shareAnonymisedData` (default off)
  (`goals.js`, `session.js`, `widget.js`).
- **P3.1 done** — sparkline renderer de-duplicated (`widget.js`).
- **P2.2 done** — shared adapter factory (`adapters/base.js`) + Claude, Gemini,
  Grok configs + registry selection (`content.js`, `manifest.json`);
  `smoke-test-adapters.mjs` (62 checks).
- **P2.3 done** — nudge-efficacy summary in digest (`nudges.js`, `widget.js`).
- **P3.2 done** — adapter interface-conformance test + fail-soft DOM guard.
- **Adapter DOM tests** — `scripts/test-adapter-dom.mjs` (jsdom) verifies real
  parsing for every factory adapter: ordering/roles/text,
  `hideAssistantResponsesAfter` + restore, `setChatInputText`, empty-DOM
  resilience. Added `scripts/package.json` + `npm test` runner.
- **Phase 3 adapters done** — Microsoft **Copilot** (`adapters/copilot.js`) and
  **Perplexity** (`adapters/perplexity.js`) added via the factory + registry +
  manifest; tests extended (now **123** checks total: 11 + 92 + 20).
- **`extension/` removed** — deprecated divergent tree and its stale
  `smoke-test-engine.mjs` deleted. Root build is the single source of truth.
- **CI + pre-commit** — `.github/workflows/test.yml` runs manifest validation,
  syntax checks, and all suites on push/PR; `.githooks/pre-commit` runs the
  suites locally (enable with `git config core.hooksPath .githooks`).
- _Staged next:_ live-tune Gemini/Grok/Copilot/Perplexity selectors against real
  logged-in sessions (their selectors are best-effort).

## Test commands
```
cd scripts && npm install      # one-time (jsdom, dev-only, gitignored)
cd scripts && npm test         # runs all four suites (135 checks)

# or individually, from repo root:
node scripts/smoke-test-shipped.mjs    # shipped engine + efficacy (11 checks)
node scripts/smoke-test-adapters.mjs   # adapter wiring/conformance (92 checks)
node scripts/test-adapter-dom.mjs      # real-DOM adapter parsing via jsdom (20 checks)
node scripts/test-e2e-chatgpt.mjs      # full pipeline → rendered DOM (12 checks)

# CI runs all of this on push/PR (.github/workflows/test.yml).
# Pre-commit: git config core.hooksPath .githooks
```
