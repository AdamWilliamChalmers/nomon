/**
 * AI Profile tests (lumen-ai-profile.md).
 *
 * 1. Round-trip: recordMessage(..., taskType) → saveSessionSnapshot writes
 *    per-platform signalCounts + taskTypeCounts into history.
 * 2. Characterisation: buildProfile turns crafted multi-day, multi-tool history
 *    into the right per-tool dominant-use + posture lines, and gates low samples.
 *
 * Run: node scripts/test-profile.mjs
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

for (const f of ["config.js", "rules.js", "net.js", "nudges.js", "engine.js", "goals.js", "session.js"])
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);

const { LumenNudges, LumenSession } = window;

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

// ── 1. Round-trip through the real session snapshot ──
const messages = [
  { id: "m1", role: "user", text: "write my essay on climate policy please", timestamp: Date.now() },
  { id: "m2", role: "assistant", text: "Sure, here is a draft...", timestamp: Date.now() },
];
LumenSession.recordMessage("m1", 55, "handoff", "essay_writing");
const history = await LumenSession.saveSessionSnapshot(messages);
const today = history[history.length - 1];
const snap = today.byPlatform?.["chatgpt.com"];
assert("snapshot stores per-platform signalCounts", snap?.signalCounts?.handoff === 1, JSON.stringify(snap?.signalCounts));
assert("snapshot stores per-platform taskTypeCounts", snap?.taskTypeCounts?.essay_writing === 1, JSON.stringify(snap?.taskTypeCounts));
assert("daily aggregate sums signalCounts", today.signalCounts?.handoff === 1, JSON.stringify(today.signalCounts));

// ── 2. Characterisation on crafted history ──
// Build `days` day-entries. ChatGPT = writing + hand-off heavy; Claude = code +
// engaged; Gemini = barely used (below the sample gate).
function day(i, byPlatform) {
  return { date: `2026-06-${String(i).padStart(2, "0")}`, byPlatform };
}
const crafted = [];
for (let i = 1; i <= 6; i++) {
  crafted.push(
    day(i, {
      "chatgpt.com": {
        messageCount: 8,
        questionRatio: 0.1,
        avgPromptLength: 6,
        passiveRate: 0.45,
        signalCounts: { handoff: 5, loop: 1, mismatch: 1, depth: 0 },
        taskTypeCounts: { essay_writing: 5, email_drafting: 2, general: 1 },
      },
      "claude.ai": {
        messageCount: 7,
        questionRatio: 0.6,
        avgPromptLength: 32,
        passiveRate: 0.05,
        signalCounts: { handoff: 0, loop: 0, mismatch: 0, depth: 2 },
        taskTypeCounts: { code_generation: 4, debugging: 2, code_explanation: 1 },
      },
    })
  );
}
// Gemini appears once with tiny volume → should stay "still learning".
crafted.push(
  day(7, {
    "gemini.google.com": {
      messageCount: 3,
      questionRatio: 0.3,
      avgPromptLength: 10,
      passiveRate: 0.1,
      signalCounts: { handoff: 1 },
      taskTypeCounts: { research: 2, general: 1 },
    },
  })
);

const profile = LumenNudges.buildProfile(crafted);
const byName = Object.fromEntries(profile.map((p) => [p.name, p]));
console.log("\nProfile output:");
profile.forEach((p) => console.log(`  ${p.line}`));
console.log();

const cgpt = byName["ChatGPT"];
const claude = byName["Claude"];
const gemini = byName["Gemini"];

assert("ChatGPT recognised", Boolean(cgpt));
assert("ChatGPT dominant use = writing", cgpt?.use === "writing", cgpt?.use);
assert("ChatGPT posture leans offload", ["mixed", "hand-off heavy"].includes(cgpt?.posture), `${cgpt?.posture} (${cgpt?.postureScore})`);
assert("Claude dominant use = code", claude?.use === "code", claude?.use);
assert("Claude posture leans engaged", ["hands-on", "collaborative"].includes(claude?.posture), `${claude?.posture} (${claude?.postureScore})`);
assert("Gemini gated (still learning)", gemini?.ready === false, JSON.stringify(gemini));
assert("ChatGPT ranked above Claude (more messages)", profile[0]?.name === "ChatGPT");

// ── 3. Cross-tool contrast line ──
const contrast = LumenNudges.buildProfileContrast(crafted);
console.log(`\nContrast: ${contrast}\n`);
assert("contrast produced", Boolean(contrast));
assert("contrast: most hands-on with code", /hands-on with code/.test(contrast || ""), contrast);
assert("contrast: hand off most with writing", /hand off most with writing/.test(contrast || ""), contrast);

// Contrast should be withheld when there isn't enough spread/data.
const flat = [
  day(1, {
    "chatgpt.com": {
      messageCount: 12,
      questionRatio: 0.4,
      avgPromptLength: 18,
      passiveRate: 0.1,
      signalCounts: { handoff: 1 },
      taskTypeCounts: { code_generation: 12 },
    },
  }),
];
assert("contrast withheld with one domain", LumenNudges.buildProfileContrast(flat) === null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
