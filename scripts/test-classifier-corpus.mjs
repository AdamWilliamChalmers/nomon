/**
 * Local-pipeline classifier corpus.
 *
 * Loads the REAL shipped rules/engine/goals (no LLM, no network) and runs a
 * labelled corpus through LumenEngine.evaluateMessage to measure two things:
 *
 *   1. Does the regex/heuristic resolve clear cases correctly ON ITS OWN
 *      (so the free, instant local layer "earns its keep")?
 *   2. For cases it gets wrong/unsure, does shouldConsultJudge correctly DEFER
 *      to the LLM (safety net) — or does it silently MISS?
 *
 * Outcome buckets per case:
 *   regex   = local primary == expected            (handled locally, ideal)
 *   defer   = local wrong/unsure BUT defers to LLM  (LLM safety net)
 *   waste   = local correct but ALSO defers to LLM  (correct, but a paid call)
 *   MISS    = local wrong AND does not defer         (silent gap — the danger)
 *
 * Run: node scripts/test-classifier-corpus.mjs
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://chatgpt.com/",
  runScripts: "outside-only",
});
const ctx = dom.getInternalVMContext();
const { window } = dom;
window.globalThis = window;
window.chrome = undefined;

const FILES = ["config.js", "rules.js", "net.js", "nudges.js", "engine.js", "goals.js", "session.js"];
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);

const { LumenGoals, LumenEngine, LumenRules, LumenEngine: Engine } = window;

const now = Date.now();
const longAi = "Here is a detailed answer. " + "reasoning ".repeat(220);

// Build a messages array. `prior` is a list of [role, text] turns that precede
// the prompt under test; the prompt is appended as the final user turn.
function build(prompt, prior = []) {
  const msgs = [];
  let t = now - (prior.length + 1) * 20000;
  prior.forEach(([role, text], i) => {
    msgs.push({ id: `p${i}`, role, text, timestamp: t });
    t += 20000;
  });
  msgs.push({ id: "target", role: "user", text: prompt, timestamp: now });
  return msgs;
}

function resolve(text, { goals = {}, prior = [] } = {}) {
  LumenGoals.save({
    onboardingComplete: true,
    mode: "active",
    useCases: [],
    protectedGoals: [],
    ...goals,
  });
  const messages = build(text, prior);
  const index = messages.length - 1;
  const userMsgs = messages.filter((m) => m.role === "user");
  const wc = (s) => s.trim().split(/\s+/).filter(Boolean).length;
  const ctxObj = {
    history: [],
    currentMetrics: {
      questionRatio: userMsgs.filter((m) => m.text.includes("?")).length / userMsgs.length,
      avgPromptLength: userMsgs.reduce((s, m) => s + wc(m.text), 0) / userMsgs.length,
      passiveRate: 0,
    },
    scoredIds: [],
    priorLoopScores: [],
    sessionSensitivity: {},
    taskTypeExempt: [],
    crowdCalibration: null,
    sessionMismatchCount: 0,
  };
  const evaluation = LumenEngine.evaluateMessage(messages[index], messages, index, ctxObj);
  const passiveLater =
    evaluation.messageIndex > 2 && Boolean(LumenEngine.isPassiveContinuation(text));
  const defers = LumenRules.shouldConsultJudge(evaluation, text, { passiveLater });
  return { primary: evaluation.primary || "none", confidence: evaluation.confidence, defers };
}

// Corpus: expect is the ideal FINAL signal. `local` (optional) is the realistic
// best the regex can do on its own when we accept a defer-to-LLM as success.
const GOAL_DRAFT = { protectedGoals: ["Write my own first drafts"] };
const GOAL_DECIDE = { protectedGoals: ["Make my own decisions"] };

const CORPUS = [
  // ── Clear hand-offs (regex SHOULD catch these locally) ──
  ["write the whole cover letter for me", "handoff"],
  ["can you write my essay on climate policy", "handoff"],
  ["build me a complete react todo app from scratch", "handoff"],
  ["draft a resignation letter", "handoff"],
  ["generate a marketing plan for my startup", "handoff"],
  ["write a letter to my landlord about repairs", "handoff"],

  // ── Subtle hand-offs (directives the tiers miss → must DEFER to LLM) ──
  ["do my homework for me", "handoff"],
  ["just give me the final answer, I don't need the working", "handoff"],
  ["Summarise this document in bullet points.", "none"],
  ["summarise this whole article so I don't have to read it", "none"],
  ["translate my entire essay into French", "handoff"],

  // ── Genuine engagement / learning (must NOT flag) ──
  ["what's the capital of France?", "none"],
  ["explain how recursion works with a simple example", "none"],
  ["why does scaled dot-product attention beat additive attention?", "none"],
  ["here's my draft intro: 'AI is changing work.' what would you tighten?", "none"],
  ["I rewrote my thesis statement three times, here's what I have so far — thoughts?", "none"],
  ["I think the bug is an off-by-one in the loop condition — am I right?", "none"],

  // ── Depth (high-stakes personal decisions) ──
  ["should I quit my job to start a business?", "depth"],
  ["what career should I pursue?", "depth"],

  // ── Mismatch (conflicts with a protected goal) ──
  ["write a letter to dad", "mismatch", GOAL_DRAFT],
  ["draft my cover letter for the new role", "mismatch", GOAL_DRAFT],
  ["decide for me which job offer to take", "mismatch", GOAL_DECIDE],

  // ── Loop (mid-conversation passive continuation) ──
  ["continue", "loop", null, [["user", "explain transformers"], ["assistant", longAi], ["user", "ok"], ["assistant", longAi]]],
  ["keep going", "loop", null, [["user", "summarise the paper"], ["assistant", longAi], ["user", "thanks"], ["assistant", longAi]]],

  // ── False-positive guards (look delegate-y but are engaged → NOT flag) ──
  ["can you explain why my code fails? here's what I tried: I added a null check", "none"],
  ["I wrote a first draft of the intro, what's weak about my argument?", "none"],
];

let regex = 0;
let defer = 0;
let waste = 0;
let miss = 0;
const rows = [];

for (const [text, expect, goals, prior] of CORPUS) {
  const r = resolve(text, { goals: goals || {}, prior: prior || [] });
  const correct = r.primary === expect;
  let bucket;
  if (correct && !r.defers) {
    bucket = "regex ✓";
    regex++;
  } else if (correct && r.defers) {
    bucket = "regex+call";
    waste++;
  } else if (!correct && r.defers) {
    bucket = "defer→LLM";
    defer++;
  } else {
    bucket = "MISS ✗";
    miss++;
  }
  rows.push({ text, expect, got: r.primary, conf: r.confidence, defers: r.defers, bucket });
}

const w = (s, n) => String(s).padEnd(n).slice(0, n);
console.log(`\n${w("prompt", 56)} ${w("expect", 9)} ${w("got", 9)} ${w("conf", 6)} ${w("defer", 6)} bucket`);
console.log("-".repeat(104));
for (const r of rows) {
  console.log(
    `${w(r.text, 56)} ${w(r.expect, 9)} ${w(r.got, 9)} ${w(r.conf, 6)} ${w(r.defers ? "yes" : "no", 6)} ${r.bucket}`
  );
}

const total = CORPUS.length;
console.log("\n── Summary ──");
console.log(`  regex ✓ (handled locally, correct)     : ${regex}/${total}`);
console.log(`  regex+call (correct but also paid LLM) : ${waste}/${total}`);
console.log(`  defer→LLM (regex unsure, safety net)   : ${defer}/${total}`);
console.log(`  MISS ✗ (wrong AND no LLM call)         : ${miss}/${total}`);
console.log(
  `\n  Local correct: ${regex + waste}/${total} · Covered (regex or defer): ${regex + waste + defer}/${total} · Silent misses: ${miss}`
);
process.exitCode = miss > 0 ? 1 : 0;
