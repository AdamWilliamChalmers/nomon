/**
 * Real-DOM behaviour tests for the platform adapters, using jsdom fixtures that
 * mirror each site's message structure. Verifies the parts the wiring test
 * can't: buildMessageList ordering/roles/text, hideAssistantResponsesAfter, and
 * setChatInputText — without needing a logged-in browser session.
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

// Build an adapter against a jsdom document built from `html`.
function loadAdapter(globalName, adapterFile, html, hostname, pathname = "/") {
  const dom = new JSDOM(html, { url: `https://${hostname}${pathname}` });
  const { window } = dom;
  const sandbox = {
    console,
    window,
    document: window.document,
    Node: window.Node,
    Event: window.Event,
    MutationObserver: window.MutationObserver,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "adapters/base.js"), "utf8"), sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, adapterFile), "utf8"), sandbox);
  return { adapter: sandbox[globalName], window };
}

const convo = (userSel, asstSel, inputHtml) => `
  <main>
    <div class="${userSel.cls || ""}" ${userSel.attr || ""}>First question for the model?</div>
    <div class="${asstSel.cls || ""}" ${asstSel.attr || ""}>A long assistant answer that explains things.</div>
    <div class="${userSel.cls || ""}" ${userSel.attr || ""}>Follow-up, shorter.</div>
    <div class="${asstSel.cls || ""}" ${asstSel.attr || ""}>Second assistant answer.</div>
  </main>
  ${inputHtml}
`;

// ── Claude ──────────────────────────────────────────────────────────────────
{
  const html = convo(
    { attr: 'data-testid="user-message"' },
    { cls: "font-claude-message" },
    '<div class="ProseMirror" contenteditable="true"></div>'
  );
  const { adapter } = loadAdapter("LumenAdapterClaude", "adapters/claude.js", html, "claude.ai");
  const list = adapter.buildMessageList();
  assert("claude: parses 4 messages", list.length === 4, `got ${list.length}`);
  assert(
    "claude: roles ordered user/assistant/user/assistant",
    list.map((m) => m.role).join(",") === "user,assistant,user,assistant",
    list.map((m) => m.role).join(",")
  );
  assert("claude: text extracted", list[0].text.startsWith("First question"), list[0].text);

  const firstUser = adapter.getUserMessages()[0];
  const restore = adapter.hideAssistantResponsesAfter(firstUser);
  const assistants = adapter.getAssistantMessages();
  assert(
    "claude: hides assistant reply after the targeted user msg",
    assistants[0].classList.contains("lumen-ai-hidden")
  );
  assert(
    "claude: stops hiding at the next user msg",
    !assistants[1].classList.contains("lumen-ai-hidden")
  );
  restore();
  assert(
    "claude: restore() un-hides",
    !assistants[0].classList.contains("lumen-ai-hidden")
  );
}

// ── Gemini ──────────────────────────────────────────────────────────────────
{
  const html = `
    <main>
      <user-query>Gemini question one?</user-query>
      <model-response>Gemini answer one.</model-response>
      <user-query>Gemini follow up.</user-query>
      <model-response>Gemini answer two.</model-response>
    </main>
    <div class="ql-editor" contenteditable="true"></div>
  `;
  const { adapter } = loadAdapter("LumenAdapterGemini", "adapters/gemini.js", html, "gemini.google.com");
  const list = adapter.buildMessageList();
  assert("gemini: parses 4 messages", list.length === 4, `got ${list.length}`);
  assert(
    "gemini: roles ordered correctly",
    list.map((m) => m.role).join(",") === "user,assistant,user,assistant",
    list.map((m) => m.role).join(",")
  );
  assert("gemini: finds composer", Boolean(adapter.findChatInput()));
}

// ── Grok ────────────────────────────────────────────────────────────────────
{
  const html = `
    <main>
      <div data-testid="user-message">Grok question one?</div>
      <div data-testid="assistant-message">Grok answer one.</div>
    </main>
    <textarea></textarea>
  `;
  const { adapter } = loadAdapter("LumenAdapterGrok", "adapters/grok.js", html, "grok.com");
  const list = adapter.buildMessageList();
  assert("grok: parses 2 messages", list.length === 2, `got ${list.length}`);
  assert(
    "grok: roles ordered user/assistant",
    list.map((m) => m.role).join(",") === "user,assistant",
    list.map((m) => m.role).join(",")
  );
  const ok = adapter.setChatInputText("drafted text");
  assert("grok: setChatInputText returns true", ok === true);
  assert(
    "grok: textarea receives the draft",
    adapter.findChatInput().value === "drafted text",
    adapter.findChatInput().value
  );
}

// ── Copilot ─────────────────────────────────────────────────────────────────
{
  const html = `
    <main>
      <div data-content="user-message">Copilot question one?</div>
      <div data-content="ai-message">Copilot answer one.</div>
      <div data-content="user-message">Copilot follow up.</div>
      <div data-content="ai-message">Copilot answer two.</div>
    </main>
    <textarea></textarea>
  `;
  const { adapter } = loadAdapter("LumenAdapterCopilot", "adapters/copilot.js", html, "copilot.microsoft.com");
  const list = adapter.buildMessageList();
  assert("copilot: parses 4 messages", list.length === 4, `got ${list.length}`);
  assert(
    "copilot: roles ordered correctly",
    list.map((m) => m.role).join(",") === "user,assistant,user,assistant",
    list.map((m) => m.role).join(",")
  );
  assert("copilot: sets composer text", adapter.setChatInputText("x") && adapter.findChatInput().value === "x");
}

// ── Perplexity ────────────────────────────────────────────────────────────────
{
  const html = `
    <main>
      <div data-testid="user-query">Perplexity question one?</div>
      <div data-testid="answer">Perplexity answer one.</div>
    </main>
    <textarea></textarea>
  `;
  const { adapter } = loadAdapter("LumenAdapterPerplexity", "adapters/perplexity.js", html, "www.perplexity.ai");
  const list = adapter.buildMessageList();
  assert("perplexity: parses 2 messages", list.length === 2, `got ${list.length}`);
  assert(
    "perplexity: roles ordered user/assistant",
    list.map((m) => m.role).join(",") === "user,assistant",
    list.map((m) => m.role).join(",")
  );
}

// ── Resilience: empty / mismatched DOM yields no messages, no throw ──────────
{
  const { adapter } = loadAdapter(
    "LumenAdapterClaude",
    "adapters/claude.js",
    "<main></main>",
    "claude.ai"
  );
  let threw = false;
  let list = [];
  try {
    list = adapter.buildMessageList();
  } catch (_) {
    threw = true;
  }
  assert("empty DOM: no throw", !threw);
  assert("empty DOM: zero messages", list.length === 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
