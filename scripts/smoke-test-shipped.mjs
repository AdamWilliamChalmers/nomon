/**
 * Smoke test for the SHIPPED extension engine (root build referenced by
 * manifest.json).
 *
 * Loads rules.js -> nudges.js -> engine.js into one VM context with minimal
 * stubs for window + LumenGoals, then asserts:
 *   - the documented false-positive cases stay quiet
 *   - explicit delegation still surfaces (as a strip, never a gate)
 *   - the seamless guarantees from PLANNING.md P0.2 hold:
 *       * no overlay in ambient/ghost mode
 *       * hand-off and depth never produce a blocking overlay
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const sandbox = { console };
sandbox.globalThis = sandbox;
sandbox.window = { location: { hostname: "chatgpt.com" } };

let currentGoals = {
  mode: "active",
  useCases: [],
  protectedGoals: [],
  focusGoal: null,
};
sandbox.LumenGoals = {
  get: () => ({ ...currentGoals }),
  isActive: () => currentGoals.mode === "active" || currentGoals.mode === "focus",
  isGhost: () => currentGoals.mode === "ghost",
};

vm.createContext(sandbox);
for (const file of ["rules.js", "nudges.js", "engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox);
}
const Engine = sandbox.LumenEngine;

const now = Date.now();
let id = 0;
const mk = (role, text, tOffsetMs = 0) => ({
  id: `m${id++}`,
  role,
  text,
  timestamp: now - tOffsetMs,
});

function evaluate({ goals = {}, messages }) {
  currentGoals = { mode: "active", useCases: [], protectedGoals: [], focusGoal: null, ...goals };
  const index = messages.length - 1;
  return Engine.evaluateMessage(messages[index], messages, index, {
    history: [],
    currentMetrics: { questionRatio: 0, avgPromptLength: 0, passiveRate: 0 },
    scoredIds: [],
    sessionMismatchCount: 0,
    priorLoopScores: [],
    sessionSensitivity: {},
    taskTypeExempt: [],
    crowdCalibration: null,
  });
}

const longAi = "word ".repeat(400);
const cases = [
  {
    name: "FP guard: summarise a long doc is not delegation",
    run: () => evaluate({ messages: [mk("user", "Summarise this document for me in bullet points.", 1000)] }),
    check: (r) => [
      r.primary !== "handoff" || "should not fire hand-off",
      r.overlayType === null || "should not gate",
      Engine.detectTaskType("Summarise this document") === "summarisation" || "task=summarisation",
    ],
  },
  {
    name: "FP guard: 'fix line 42' is debugging, not delegation",
    run: () => evaluate({ messages: [mk("user", "fix line 42, there's an error in the stack trace", 1000)] }),
    check: (r) => [
      r.primary !== "handoff" || "should not fire hand-off",
      Engine.detectTaskType("fix this bug error") === "debugging" || "task=debugging",
    ],
  },
  {
    name: "delegation surfaces as hand-off strip, never a gate (msg 1, active)",
    run: () => evaluate({ messages: [mk("user", "Write me a cover letter for this job application.", 1000)] }),
    check: (r) => [
      r.primary === "handoff" || `expected hand-off, got ${r.primary}`,
      r.overlayType === null || "hand-off must not gate on msg 1",
      r.framing.tier === 1 || "tier 1 delegation",
    ],
  },
  {
    name: "seamless: ambient mode never opens an overlay",
    run: () =>
      evaluate({
        goals: { mode: "ambient" },
        messages: [
          mk("user", "q1?", 60000),
          mk("assistant", longAi, 55000),
          mk("user", "q2 something specific?", 40000),
          mk("assistant", longAi, 35000),
          mk("user", "q3?", 20000),
          mk("assistant", longAi, 8000),
          mk("user", "do it", 4000),
        ],
      }),
    check: (r) => [r.overlayType === null || "ambient must never gate"],
  },
  {
    name: "passive 'thanks, continue.' yields high passive-acceptance signal",
    run: () =>
      evaluate({
        messages: [
          mk("user", "explain the tradeoffs of microservices?", 60000),
          mk("assistant", longAi, 55000),
          mk("user", "what about latency concerns specifically?", 40000),
          mk("assistant", longAi, 35000),
          mk("user", "and data consistency?", 20000),
          mk("assistant", longAi, 8000),
          mk("user", "thanks, continue.", 4000),
        ],
      }),
    check: (r) => [
      (r.loopSignals.passiveAcceptance >= 80) || `passive ${r.loopSignals.passiveAcceptance} < 80`,
    ],
  },
  {
    name: "depth invitation never gates the answer (active)",
    run: () => evaluate({ messages: [mk("user", "Should I quit my job to start a company?", 1000)] }),
    check: (r) => [
      r.depth.active === true || "depth should be active",
      r.overlayType === null || "depth must never gate",
    ],
  },
  {
    name: "engagement override: long first-person prompt is not flagged",
    run: () =>
      evaluate({
        messages: [
          mk(
            "user",
            "I think the argument is weak because it ignores second-order effects. Here is my draft: " +
              "I have been trying to understand whether the policy actually reduces harm, and my view is that " +
              "the evidence is mixed across the studies I have read so far this month and last.",
            1000
          ),
        ],
      }),
    check: (r) => [
      r.engagementOverride === true || "engagement override should trigger",
      r.primary !== "handoff" || "should not fire hand-off on engaged input",
    ],
  },
];

let passed = 0;
let failed = 0;
for (const c of cases) {
  let result;
  try {
    result = c.run();
  } catch (err) {
    failed++;
    console.log(`FAIL  ${c.name}\n      threw: ${err.message}`);
    continue;
  }
  const errors = c.check(result).filter((x) => x !== true);
  if (errors.length) {
    failed++;
    console.log(`FAIL  ${c.name}`);
    errors.forEach((e) => console.log(`      ${e}`));
  } else {
    passed++;
    console.log(`PASS  ${c.name} (primary=${result.primary}, overlay=${result.overlayType}, loop=${result.loopScore})`);
  }
}

// Nudge efficacy aggregation (P2.3)
const Nudges = sandbox.LumenNudges;
const eff = Nudges.summariseResponses({
  loopBreaks: [{ action: "draft-first" }, { action: "draft-submitted" }],
  depthMoments: [{ action: "reflected" }, { action: "skip" }],
  mismatchEvents: [{ choice: "pause" }, { choice: "goal-changed" }],
  overlayEvents: [{ overlayBypassed: true }],
});
const effChecks = [
  [eff.engaged === 4, `engaged ${eff.engaged} !== 4 (2 drafted + 1 reflected + 1 paused)`],
  [eff.skipped === 2, `skipped ${eff.skipped} !== 2 (1 depth skip + 1 bypass)`],
  [eff.total === 6 && eff.rate === 67, `rate ${eff.rate}% (expected 67)`],
];
for (const [ok, msg] of effChecks) {
  if (ok) {
    passed++;
    console.log("PASS  efficacy: " + msg.replace(/ !==.*/, ""));
  } else {
    failed++;
    console.log("FAIL  efficacy: " + msg);
  }
}
const emptyEff = Nudges.summariseResponses({});
if (emptyEff.total === 0 && emptyEff.rate === 0) {
  passed++;
  console.log("PASS  efficacy: empty log is safe");
} else {
  failed++;
  console.log("FAIL  efficacy: empty log not safe");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
