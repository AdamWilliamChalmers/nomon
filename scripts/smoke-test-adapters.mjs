/**
 * Adapter wiring smoke test: host matching + manifest registration.
 * Pure logic only (no live DOM).
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const sandbox = { console };
sandbox.globalThis = sandbox;
sandbox.window = { location: { hostname: "", pathname: "/" } };
sandbox.document = { querySelector: () => null, querySelectorAll: () => [] };
sandbox.Node = { DOCUMENT_POSITION_FOLLOWING: 4, DOCUMENT_POSITION_PRECEDING: 2 };

vm.createContext(sandbox);
for (const file of [
  "adapters/chatgpt.js",
  "adapters/base.js",
  "adapters/claude.js",
  "adapters/gemini.js",
  "adapters/grok.js",
  "adapters/copilot.js",
  "adapters/perplexity.js",
  "adapters/mistral.js",
  "adapters/meta.js",
  "adapters/deepseek.js",
  "adapters/qwen.js",
  "adapters/kimi.js",
  "adapters/minimax.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox);
}

const chatgpt = sandbox.LumenAdapterChatGPT;
const claude = sandbox.LumenAdapterClaude;
const gemini = sandbox.LumenAdapterGemini;
const grok = sandbox.LumenAdapterGrok;
const copilot = sandbox.LumenAdapterCopilot;
const perplexity = sandbox.LumenAdapterPerplexity;
const mistral = sandbox.LumenAdapterMistral;
const meta = sandbox.LumenAdapterMeta;
const deepseek = sandbox.LumenAdapterDeepSeek;
const qwen = sandbox.LumenAdapterQwen;
const kimi = sandbox.LumenAdapterKimi;
const minimax = sandbox.LumenAdapterMiniMax;
const allAdapters = [
  ["chatgpt", chatgpt],
  ["claude", claude],
  ["gemini", gemini],
  ["grok", grok],
  ["copilot", copilot],
  ["perplexity", perplexity],
  ["mistral", mistral],
  ["meta", meta],
  ["deepseek", deepseek],
  ["qwen", qwen],
  ["kimi", kimi],
  ["minimax", minimax],
];

function matchesOn(adapter, hostname, pathname = "/") {
  sandbox.window.location.hostname = hostname;
  sandbox.window.location.pathname = pathname;
  return adapter.matches();
}

let passed = 0;
let failed = 0;
const assert = (label, cond) => {
  if (cond) {
    passed++;
    console.log(`PASS  ${label}`);
  } else {
    failed++;
    console.log(`FAIL  ${label}`);
  }
};

assert("chatgpt matches chatgpt.com", matchesOn(chatgpt, "chatgpt.com"));
assert("chatgpt matches chat.openai.com", matchesOn(chatgpt, "chat.openai.com"));
assert("chatgpt does NOT match claude.ai", !matchesOn(chatgpt, "claude.ai"));
assert("claude matches claude.ai", matchesOn(claude, "claude.ai"));
assert("claude does NOT match chatgpt.com", !matchesOn(claude, "chatgpt.com"));
assert("gemini matches gemini.google.com", matchesOn(gemini, "gemini.google.com"));
assert("gemini does NOT match chatgpt.com", !matchesOn(gemini, "chatgpt.com"));
assert("grok matches grok.com", matchesOn(grok, "grok.com"));
assert("grok matches x.com/i/grok path", matchesOn(grok, "x.com", "/i/grok"));
assert("grok does NOT match x.com home", !matchesOn(grok, "x.com", "/home"));
assert("grok does NOT match chatgpt.com", !matchesOn(grok, "chatgpt.com"));
assert("copilot matches copilot.microsoft.com", matchesOn(copilot, "copilot.microsoft.com"));
assert("copilot does NOT match chatgpt.com", !matchesOn(copilot, "chatgpt.com"));
assert("perplexity matches perplexity.ai", matchesOn(perplexity, "perplexity.ai"));
assert("perplexity matches www.perplexity.ai", matchesOn(perplexity, "www.perplexity.ai"));
assert("perplexity does NOT match chatgpt.com", !matchesOn(perplexity, "chatgpt.com"));
assert("mistral matches chat.mistral.ai", matchesOn(mistral, "chat.mistral.ai"));
assert("mistral does NOT match chatgpt.com", !matchesOn(mistral, "chatgpt.com"));
assert("meta matches meta.ai", matchesOn(meta, "meta.ai"));
assert("meta matches www.meta.ai", matchesOn(meta, "www.meta.ai"));
assert("meta does NOT match chatgpt.com", !matchesOn(meta, "chatgpt.com"));
assert("deepseek matches chat.deepseek.com", matchesOn(deepseek, "chat.deepseek.com"));
assert("deepseek does NOT match chatgpt.com", !matchesOn(deepseek, "chatgpt.com"));
assert("qwen matches chat.qwen.ai", matchesOn(qwen, "chat.qwen.ai"));
assert("qwen does NOT match chatgpt.com", !matchesOn(qwen, "chatgpt.com"));
assert("kimi matches kimi.com", matchesOn(kimi, "kimi.com"));
assert("kimi matches kimi.moonshot.cn", matchesOn(kimi, "kimi.moonshot.cn"));
assert("kimi does NOT match chatgpt.com", !matchesOn(kimi, "chatgpt.com"));
assert("minimax matches chat.minimax.io", matchesOn(minimax, "chat.minimax.io"));
assert("minimax matches chat.minimaxi.com", matchesOn(minimax, "chat.minimaxi.com"));
assert("minimax does NOT match chatgpt.com", !matchesOn(minimax, "chatgpt.com"));

// Exactly one adapter should claim each host (no overlap).
const hostCases = [
  ["chatgpt.com", "/"],
  ["chat.openai.com", "/"],
  ["claude.ai", "/"],
  ["gemini.google.com", "/"],
  ["grok.com", "/"],
  ["x.com", "/i/grok"],
  ["copilot.microsoft.com", "/"],
  ["perplexity.ai", "/"],
  ["www.perplexity.ai", "/"],
  ["chat.mistral.ai", "/"],
  ["meta.ai", "/"],
  ["www.meta.ai", "/"],
  ["chat.deepseek.com", "/"],
  ["chat.qwen.ai", "/"],
  ["kimi.com", "/"],
  ["kimi.moonshot.cn", "/"],
  ["chat.minimax.io", "/"],
  ["chat.minimaxi.com", "/"],
];
for (const [host, pathname] of hostCases) {
  const claimers = allAdapters.filter(([, a]) => matchesOn(a, host, pathname)).length;
  assert(`exactly one adapter claims ${host}${pathname}`, claimers === 1);
}

// Interface conformance — every adapter must implement what content.js /
// widget.js call, so a new adapter can't silently miss a method.
const REQUIRED_METHODS = [
  "matches",
  "getMessageContainer",
  "buildMessageList",
  "findUserMessageWrapper",
  "findChatInput",
  "getChatInputText",
  "findSendButton",
  "triggerSend",
  "setChatInputText",
  "hideAssistantResponsesAfter",
  "onNewMessage",
];
for (const [name, adapter] of allAdapters) {
  for (const m of REQUIRED_METHODS) {
    assert(`${name} implements ${m}()`, typeof adapter[m] === "function");
  }
}

// Manifest wiring.
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const cs = manifest.content_scripts[0];
assert("manifest loads chatgpt adapter", cs.js.includes("adapters/chatgpt.js"));
assert("manifest loads base factory", cs.js.includes("adapters/base.js"));
for (const a of [
  "claude",
  "gemini",
  "grok",
  "copilot",
  "perplexity",
  "mistral",
  "meta",
  "deepseek",
  "qwen",
  "kimi",
  "minimax",
]) {
  assert(`manifest loads ${a} adapter`, cs.js.includes(`adapters/${a}.js`));
  assert(
    `base loads before ${a} (factory available)`,
    cs.js.indexOf("adapters/base.js") < cs.js.indexOf(`adapters/${a}.js`)
  );
}
for (const host of [
  "claude.ai",
  "gemini.google.com",
  "grok.com",
  "x.com/i/grok",
  "copilot.microsoft.com",
  "perplexity.ai",
  "chat.mistral.ai",
  "meta.ai",
  "chat.deepseek.com",
  "chat.qwen.ai",
  "kimi.com",
  "kimi.moonshot.cn",
  "chat.minimax.io",
  "chat.minimaxi.com",
]) {
  assert(`manifest matches ${host}`, cs.matches.some((m) => m.includes(host)));
}
assert(
  "all adapters load before content.js",
  cs.js.indexOf("adapters/minimax.js") < cs.js.indexOf("content.js")
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
