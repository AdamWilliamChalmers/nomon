/**
 * End-to-end pipeline test against a simulated ChatGPT DOM (jsdom).
 *
 * This is the closest faithful substitute for a live browser test: it loads the
 * REAL shipped modules (rules → nudges → engine → goals → session → sparkline →
 * widget + the ChatGPT adapter) into a jsdom window and runs the same pipeline
 * content.js runs (evaluate → record → inject UI), then asserts the actual DOM
 * the user would see: the badge, inline strips, the mismatch card, the feedback
 * button — and that NO signal hides the AI response (the P0.2 seamless rule).
 *
 * It cannot validate: real ChatGPT selectors/markup, visual styling, or live
 * overlay click flows — those need a logged-in browser with the extension
 * installed (see the manual QA checklist printed at the end).
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

let passed = 0;
let failed = 0;
const assert = (label, cond, detail = "") => {
  if (cond) {
    passed++;
    console.log(`PASS  ${label}`);
  } else {
    failed++;
    console.log(`FAIL  ${label}${detail ? " — " + detail : ""}`);
  }
};

// A realistic ChatGPT conversation: two engaged turns, then a delegation that
// conflicts with a protected goal ("write my own first drafts").
const turn = (role, text) => `
  <article data-testid="conversation-turn">
    <div data-message-author-role="${role}">
      <div class="markdown prose">${text}</div>
    </div>
  </article>`;

const html = `<!doctype html><html><body>
  <main>
    ${turn("user", "Explain how transformer attention works?")}
    ${turn("assistant", "Attention lets the model weigh tokens. " + "detail ".repeat(220))}
    ${turn("user", "Why use scaled dot-product specifically rather than additive?")}
    ${turn("assistant", "Scaling stabilises gradients. " + "detail ".repeat(220))}
    ${turn("user", "Write my essay arguing that social media harms democracy.")}
  </main>
  <textarea id="prompt-textarea"></textarea>
</body></html>`;

const dom = new JSDOM(html, { url: "https://chatgpt.com/", runScripts: "outside-only" });
const ctx = dom.getInternalVMContext();
const { window } = dom;
window.globalThis = window;
// In a real content script `chrome` is always defined; in jsdom it isn't, so
// declare it as undefined → modules fall back to localStorage/sessionStorage.
window.chrome = undefined;

// Load the shipped modules in manifest order (chrome is undefined → modules use
// their localStorage/sessionStorage fallbacks, which jsdom provides).
const FILES = [
  "config.js",
  "adapters/chatgpt.js",
  "rules.js",
  "net.js",
  "nudges.js",
  "engine.js",
  "goals.js",
  "judge.js",
  "session.js",
  "sparkline.js",
  "widget.js",
];
for (const f of FILES) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);
}

const { LumenGoals, LumenSession, LumenEngine, LumenWidget, LumenAdapterChatGPT } = window;

assert("modules loaded", Boolean(LumenGoals && LumenSession && LumenEngine && LumenWidget && LumenAdapterChatGPT));
assert("adapter matches chatgpt.com", LumenAdapterChatGPT.matches());

// Active mode + a protected goal so Mismatch can fire.
LumenGoals.save({
  onboardingComplete: true,
  mode: "active",
  protectedGoals: ["I want to write my own first drafts"],
  useCases: [],
});

LumenWidget.init();
assert("badge (#lumen-fab) injected", Boolean(window.document.getElementById("lumen-fab")));

// Mirror content.js processMessages.
const messages = LumenAdapterChatGPT.buildMessageList();
assert("adapter parsed all 5 turns", messages.length === 5, `got ${messages.length}`);

const now = Date.now();
messages.forEach((m, i) => {
  m.timestamp = now - (messages.length - i) * 1000;
});

let mismatchEval = null;
messages.forEach((msg, index) => {
  if (msg.role !== "user") return;
  const session = LumenSession.get();
  const evaluation = LumenEngine.evaluateMessage(msg, messages, index, {
    history: [],
    currentMetrics: LumenSession.computeSessionMetrics(messages),
    scoredIds: session.scoredMessageIds,
    sessionMismatchCount: session.mismatchCount,
    priorLoopScores: session.loopScores,
    sessionSensitivity: LumenSession.getSessionSensitivity(),
    taskTypeExempt: LumenGoals.getTaskTypeExemptions(),
    crowdCalibration: LumenGoals.getCrowdCalibration(),
  });
  if (!session.scoredMessageIds.includes(msg.id)) {
    LumenSession.recordMessage(msg.id, evaluation.loopScore, evaluation.primary);
  }
  LumenWidget.injectMessageUI(msg, evaluation, LumenAdapterChatGPT, { isNewMessage: true });
  if (evaluation.primary === "mismatch") mismatchEval = evaluation;
});
LumenWidget.updateBadge();

const doc = window.document;

// ── Assertions on the rendered DOM ───────────────────────────────────────────
const strips = doc.querySelectorAll(".lumen-strip");
assert("at least one inline strip rendered", strips.length >= 1, `got ${strips.length}`);
assert("strip carries a feedback button", Boolean(doc.querySelector(".lumen-fb-btn")));

assert("delegation produced a mismatch signal", Boolean(mismatchEval), "no mismatch primary");
assert("mismatch card rendered (active mode)", Boolean(doc.querySelector(".lumen-card--mismatch")));

// Seamless guarantee: no signal hid the AI response.
assert(
  "no AI response hidden (.lumen-ai-hidden absent)",
  doc.querySelectorAll(".lumen-ai-hidden").length === 0
);

// Badge shows a word band (Engaged / Steady / …) once the session has messages.
const badge = doc.getElementById("lumen-fab-label");
const badgeText = badge?.textContent?.trim();
const validLabels = ["Engaged", "Steady", "Drifting", "Passive", "Paused", "—"];
assert(
  "badge shows engagement label",
  validLabels.includes(badgeText),
  badgeText
);
assert("badge not stuck on empty dash after messages", badgeText !== "—", badgeText);
assert("session recorded all user messages", LumenSession.get().messageCount === 3, `count ${LumenSession.get().messageCount}`);

// Ghost mode hides in-session UI.
LumenGoals.save({ mode: "ghost" });
assert("ghost mode reported by goals", LumenGoals.isGhost());

// ── First run is a quiet invitation, never a blocking modal ──────────────────
// Reset to a never-set-up state and confirm showOnboardingIfNeeded() only marks
// the pill (a subtle dot) rather than auto-opening the setup cards.
LumenGoals.save({ onboardingComplete: false, setupInviteSeen: false });
doc.getElementById("lumen-onboarding")?.classList.remove("lumen-onboarding--open");

LumenWidget.showOnboardingIfNeeded();
assert(
  "first run does NOT auto-open the setup modal",
  !doc.getElementById("lumen-onboarding")?.classList.contains("lumen-onboarding--open")
);
assert(
  "first run marks setup CTA as pending",
  doc.getElementById("lumen-setup-cta")?.classList.contains("lumen-popover-setup-cta--pending")
);

// The setup cards open only on explicit user action (the popover CTA).
doc.getElementById("lumen-setup-cta")?.dispatchEvent(new window.Event("click"));
assert(
  "clicking the setup CTA opens the guided cards",
  Boolean(doc.getElementById("lumen-onboarding")?.classList.contains("lumen-onboarding--open"))
);

console.log(`\n${passed} passed, ${failed} failed`);

console.log(`
── Manual QA (needs the extension loaded in your Chrome, logged into ChatGPT) ──
  1. chrome://extensions → Developer mode → Load unpacked → this repo root.
  2. Open chatgpt.com on a fresh profile; confirm the Lumen pill appears with NO
     blocking modal. Open the pill → "Set up Nomon →" has a very subtle pulse.
     Reload: pulse persists until setup is completed or skipped, still no modal.
  2b. Open the pill → click "Set up Nomon →"; the guided cards open.
     Complete or Skip → the pulse stops; the button reads "Review setup →".
  2c. In the popover, toggle "What you use AI for" chips and edit "Protected
     goals"; reopen setup and confirm the cards reflect those edits.
  3. Send "write my essay on X" as msg 1 → expect a hand-off strip, NO modal,
     answer NOT hidden.
  4. In Active mode with a protected goal, send a matching delegation → expect
     the mismatch card; answer still visible.
  5. Ask "should I quit my job?" in Active → expect a depth strip only (no card);
     answer visible. In Guard, optional depth card with "Got it — just asking".
  6. Have a long, passive exchange (short replies to long answers) in Active →
     after msg 3 the Loop reconsider overlay may appear (the one intended gate).
  7. Switch to Ambient → only strips, never a modal. Switch to Ghost → nothing.
  8. Open the pill popover → Engagement number, sparkline, "Your responses"
     line, Backend URL field, and the consent + study toggles.
  9. Repeat selector check on claude.ai / gemini / grok / copilot / perplexity
     (their selectors are best-effort and may need tuning).
`);

process.exit(failed ? 1 : 0);
