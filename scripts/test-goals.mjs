/**
 * Protected-goals storage helpers + mismatch card copy.
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const sandbox = { console };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.LumenConfig = {
  judgeApiUrl: () => "http://localhost:3000/api/judge",
  webAppUrl: () => "http://localhost:3000",
};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "config.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "goals.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "nudges.js"), "utf8"), sandbox);

const { LumenGoals, LumenNudges } = sandbox;

let passed = 0;
let failed = 0;
function assert(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

const presets = LumenGoals.listPresetGoals();
assert("six preset goals", presets.length === 6);

const split = LumenGoals.splitProtectedGoals([
  presets[0],
  "My custom goal",
  presets[1],
]);
assert("split separates presets and custom", split.presetGoals.length === 2);
assert("split keeps custom goals", split.customGoals.join("") === "My custom goal");

const merged = LumenGoals.mergeProtectedGoals({
  presetGoals: [presets[0], presets[0], "Write my own first drafts"],
  customGoals: ["My custom goal", presets[0]],
});
assert("merge dedupes", merged.length === 2);
assert("merge keeps preset canonical string", merged.includes(presets[0]));
assert("merge keeps custom", merged.includes("My custom goal"));

const copy = LumenNudges.getMismatchCardCopy(presets[0], 1);
assert("mismatch copy has dismiss action", copy.dismissLabel === "Just this once");
assert("mismatch copy has remove action", copy.removeLabel === "Remove this goal");
assert("mismatch copy has no legacy continue label", copy.continueLabel == null);

let notifyCount = 0;
const off = LumenGoals.onChange(() => {
  notifyCount += 1;
});
LumenGoals.save({ protectedGoals: [...LumenGoals.get().protectedGoals, "Test custom goal"] });
assert("onChange fires after save", notifyCount === 1);
off();
LumenGoals.save({
  protectedGoals: LumenGoals.get().protectedGoals.filter((g) => g !== "Test custom goal"),
});

const defaultsSandbox = { console, globalThis: null, window: null, LumenConfig: sandbox.LumenConfig };
defaultsSandbox.globalThis = defaultsSandbox;
defaultsSandbox.window = defaultsSandbox;
vm.createContext(defaultsSandbox);
vm.runInContext(fs.readFileSync(path.join(root, "config.js"), "utf8"), defaultsSandbox);
vm.runInContext(fs.readFileSync(path.join(root, "goals.js"), "utf8"), defaultsSandbox);
assert("study default on", defaultsSandbox.LumenGoals.get().studyParticipant === true);
assert("share default on", defaultsSandbox.LumenGoals.get().shareAnonymisedData === true);

assert("normalizeMode keeps ghost", LumenGoals.normalizeMode("ghost") === "ghost");
assert("normalizeMode migrates focus", LumenGoals.normalizeMode("focus") === "active");
assert("normalizeMode rejects unknown", LumenGoals.normalizeMode("nope") === "active");
assert(
  "modeMeta unknown falls back to active blurb",
  LumenGoals.modeMeta("nope").value === "active"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
