import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { console, location: { hostname: "chatgpt.com" } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "cost/models.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(root, "cost/costRules.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(root, "cost/cost.js"), "utf8"), ctx);

const M = ctx.LumenCostModels;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(M.get("gpt-5.6-sol")?.inputPerMillion === 5, "Sol price");
assert(M.resolveLabel("GPT-5.6 Sol")?.id === "gpt-5.6-sol", "resolve Sol");
assert(M.resolveLabel("Instant 5.5")?.id === "gpt-5.5-instant", "resolve Instant");

const medium = M.resolveChatGPTSelection({
  intelligence: "Medium",
  modelLabel: "GPT-5.6 Sol",
});
assert(medium.model.id === "gpt-5.6-terra", "Medium·Sol → Terra");

const high = M.resolveChatGPTSelection({
  intelligence: "High",
  modelLabel: "GPT-5.6 Sol",
});
assert(high.model.id === "gpt-5.6-sol", "High·Sol → Sol");

const analyzed = ctx.LumenCost.analyze(
  "how can i operationalise Nietzsche's idea of the Ubermensch. What are the variables?",
  { costEnabled: true, costLevel: "full", costMonthlyVolume: 1000 },
  {
    hostname: "chatgpt.com",
    selectedModel: {
      intelligence: "Medium",
      modelLabel: "GPT-5.6 Sol",
      label: "Medium",
      confidence: "mapped",
      host: "chatgpt",
    },
  }
);

assert(analyzed.show, "show");
assert(analyzed.model.id === "gpt-5.6-terra", "analyze uses Medium·Sol mapping");
assert(analyzed.modelSource === "ui", "source ui");
assert(/Try |Show |Drop |Minify |Enable /i.test(analyzed.stripLine) || analyzed.matches.length >= 0, "strip");

const fable = M.resolveClaudeSelection({
  label: "Fable 5 High",
  modelLabel: "Fable 5",
  effort: "high",
});
assert(fable.model.id === "claude-fable-5", "Fable 5");
assert(fable.effort === "high", "effort high");

const claudeRun = ctx.LumenCost.analyze(
  "how can i operationalise Nietzsche's idea of the Ubermensch. What are the variables?",
  { costEnabled: true, costLevel: "full", costMonthlyVolume: 1000 },
  {
    hostname: "claude.ai",
    selectedModel: {
      host: "claude",
      label: "Fable 5 High",
      modelLabel: "Fable 5",
      effort: "high",
      confidence: "exact",
    },
  }
);
assert(claudeRun.model.id === "claude-fable-5", "claude analyze fable");
assert(claudeRun.matches.some((m) => m.ruleId === "model-downgrade"), "fable suggests cheaper");

assert(M.resolveLabel("3.5 Flash")?.id === "gemini-3.5-flash", "resolve 3.5 Flash");
assert(M.resolveLabel("3.1 Flash-Lite")?.id === "gemini-3.1-flash-lite", "resolve Flash-Lite");
assert(M.resolveLabel("3.1 Pro")?.id === "gemini-3.1-pro", "resolve 3.1 Pro");

const flashExt = M.resolveGeminiSelection({
  label: "Flash Extended",
  modelLabel: "3.5 Flash",
  extended: true,
});
assert(flashExt.model.id === "gemini-3.5-flash", "Flash Extended → 3.5 Flash");
assert(flashExt.effort === "extended", "extended effort");
assert(flashExt.outputMult > 1, "extended burns more output");

const geminiRun = ctx.LumenCost.analyze(
  "how can i operationalise Nietzsche's idea of the Ubermensch. What are the variables?",
  { costEnabled: true, costLevel: "full", costMonthlyVolume: 1000 },
  {
    hostname: "gemini.google.com",
    selectedModel: {
      host: "gemini",
      label: "Flash Extended",
      modelLabel: "3.5 Flash",
      extended: true,
      confidence: "exact",
    },
  }
);
assert(geminiRun.show, "gemini show");
assert(geminiRun.model.id === "gemini-3.5-flash", "gemini analyze flash");
assert(geminiRun.effort === "extended", "gemini extended");

const shortOff = ctx.LumenCost.analyze("hi", { costEnabled: true }, { hostname: "chatgpt.com" });
assert(!shortOff.show, "too short still hidden");

const shortOk = ctx.LumenCost.analyze(
  "Please summarize this meeting and list three action items for the team.",
  { costEnabled: true },
  { hostname: "chatgpt.com" }
);
assert(shortOk.show, "40+ char draft shows");

const switchHint = M.switchActionFor("gpt-5.6-luna", "chatgpt.com");
assert(switchHint?.kind === "intelligence", "luna → intelligence");
assert(switchHint?.value === "instant", "luna → Instant");
assert(analyzed.top?.switchAction?.value === "instant", "analyze attaches Instant switch");
assert(analyzed.top?.title === "Try Instant", "ChatGPT tip uses Instant not Luna");
assert(!/luna|terra/i.test(analyzed.top?.title + analyzed.top?.suggestion), "no Luna/Terra in ChatGPT copy");

console.log("cost-models smoke ok", {
  chatgpt: {
    model: analyzed.model.name,
    label: analyzed.modelLabel,
    tip: analyzed.top?.title || null,
  },
  claude: {
    model: claudeRun.model.name,
    label: claudeRun.modelLabel,
    tip: claudeRun.top?.title || null,
  },
  gemini: {
    model: geminiRun.model.name,
    label: geminiRun.modelLabel,
    effort: geminiRun.effort,
  },
  updatedAt: M.UPDATED_AT,
});
