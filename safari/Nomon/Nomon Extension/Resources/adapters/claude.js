/* Claude.ai adapter — built on the shared factory (adapters/base.js). */
globalThis.LumenAdapterClaude = globalThis.LumenCreateAdapter({
  hostnames: ["claude.ai"],
  platform: "claude",
  userSelector: '[data-testid="user-message"], .font-user-message',
  assistantSelector: '.font-claude-message, [data-testid="assistant-message"]',
  assistantWrappers: [
    '[data-testid="assistant-message"]',
    ".font-claude-message",
    "[data-test-render-count]",
  ],
  userWrappers: [
    '[data-testid="user-message"]',
    ".font-user-message",
    "[data-test-render-count]",
  ],
  inputs: [
    'div.ProseMirror[contenteditable="true"]',
    '[contenteditable="true"]',
    "textarea",
  ],
});

/**
 * Read Claude's model + Effort picker (pill often reads "Fable 5 High").
 * Menus: Fable 5 / Opus 4.8 / Sonnet 5 / Haiku 4.5 + Effort Low…Max.
 */
globalThis.LumenAdapterClaude.getSelectedModel = function getSelectedModel() {
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

  const EFFORT_RE = /^(low|medium|high|extra|max)$/i;
  const MODEL_RE =
    /\b((?:claude\s+)?(?:fable|opus|sonnet|haiku|mythos)\s*\d+(?:\.\d+)?)\b/i;

  const texts = [];
  const pushText = (raw, source) => {
    const t = clean(raw);
    if (!t || t.length > 100) return;
    texts.push({ t, source });
  };

  const switcherSelectors = [
    'button[aria-label*="Model" i]',
    'button[aria-haspopup="menu"]',
    '[data-testid*="model" i]',
    'button[class*="model" i]',
  ];
  for (const sel of switcherSelectors) {
    try {
      document.querySelectorAll(sel).forEach((el) => {
        pushText(el.getAttribute("aria-label"), "switcher-aria");
        pushText(el.textContent, "switcher");
      });
    } catch (_) {
      /* invalid selector in older engines — ignore */
    }
  }

  document
    .querySelectorAll(
      '[role="menuitemradio"][aria-checked="true"], [role="menuitem"][aria-checked="true"], [role="option"][aria-selected="true"]'
    )
    .forEach((el) => {
      pushText(el.getAttribute("aria-label") || el.textContent, "menu-checked");
    });

  // Open menus list model names even before aria-checked settles
  document.querySelectorAll('[role="menu"] [role="menuitem"], [role="menu"] button').forEach((el) => {
    const t = clean(el.textContent);
    if (MODEL_RE.test(t) || /effort/i.test(t)) pushText(t, "menu-item");
  });

  const input = this.findChatInput?.();
  const composer =
    input?.closest("form") ||
    input?.closest("[class*='composer']") ||
    input?.closest("fieldset") ||
    input?.parentElement?.parentElement;
  if (composer) {
    composer.querySelectorAll("button").forEach((btn) => {
      const t = clean(btn.textContent);
      if (MODEL_RE.test(t) || EFFORT_RE.test(t) || /\b(fable|opus|sonnet|haiku)\b/i.test(t)) {
        pushText(t, "composer-btn");
      }
    });
  }

  let effort = null;
  let modelLabel = null;
  let label = null;

  for (const { t } of texts) {
    // Combined pill: "Fable 5 High"
    const combo = t.match(
      /((?:claude\s+)?(?:fable|opus|sonnet|haiku|mythos)\s*\d+(?:\.\d+)?)\s+(low|medium|high|extra|max)\b/i
    );
    if (combo) {
      modelLabel = combo[1];
      effort = combo[2];
      label = t;
      break;
    }
  }

  if (!modelLabel) {
    for (const { t } of texts) {
      if (!effort) {
        const effortOnly = t.match(/\b(low|medium|high|extra|max)\b/i);
        // Prefer explicit Effort row ("Effort High") over stray words
        if (/effort/i.test(t) && effortOnly) effort = effortOnly[1];
        else if (EFFORT_RE.test(t)) effort = t;
      }
      const modelMatch = t.match(MODEL_RE);
      if (!modelLabel && modelMatch) modelLabel = modelMatch[1];
      if (!label && modelMatch) label = t;
    }
  }

  if (!label && modelLabel) {
    label = effort ? `${modelLabel} ${effort}` : modelLabel;
  }

  if (!label && !modelLabel && !effort) {
    return {
      id: null,
      label: null,
      intelligence: null,
      effort: null,
      modelLabel: null,
      confidence: "unknown",
      host: "claude",
    };
  }

  return {
    id: null,
    label,
    // reuse intelligence slot for ChatGPT resolver safety — Claude uses effort
    intelligence: null,
    effort: effort ? effort.toLowerCase() : null,
    modelLabel,
    confidence: modelLabel ? "exact" : "mapped",
    host: "claude",
  };
};

/**
 * Best-effort: open Claude’s model/Effort menu and pick the tip target.
 * @param {{ kind?: string, value?: string, uiLabel?: string }} action
 */
globalThis.LumenAdapterClaude.switchModel = async function switchModel(action = {}) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const clickEl = (el) => {
    if (!el) return false;
    el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
    el.click();
    return true;
  };

  const findItem = (want) => {
    const target = clean(want).toLowerCase();
    const nodes = document.querySelectorAll(
      '[role="menuitemradio"], [role="menuitem"], [role="option"], button'
    );
    for (const el of nodes) {
      const t = clean(el.getAttribute("aria-label") || el.textContent).toLowerCase();
      if (!t || t.length > 80) continue;
      if (t === target || t.includes(target)) return el;
    }
    return null;
  };

  const openPicker = () => {
    const before = this.getSelectedModel?.() || {};
    const pillRe = /fable|opus|sonnet|haiku|effort/i;
    const input = this.findChatInput?.();
    const composer =
      input?.closest("form") ||
      input?.closest("[class*='composer']") ||
      input?.parentElement?.parentElement;
    const buttons = [];
    document
      .querySelectorAll('button[aria-haspopup="menu"], button[aria-label*="Model" i]')
      .forEach((b) => buttons.push(b));
    if (composer) {
      composer.querySelectorAll("button").forEach((b) => {
        if (pillRe.test(clean(b.textContent))) buttons.push(b);
      });
    }
    for (const b of buttons) {
      const t = clean(b.textContent);
      if (pillRe.test(t) || /model/i.test(b.getAttribute("aria-label") || "")) {
        if (clickEl(b)) return true;
      }
    }
    // Fallback: any composer button that looks like current pill
    if (before.label) {
      for (const b of buttons) {
        if (clean(b.textContent).includes(clean(before.modelLabel || "").slice(0, 6))) {
          if (clickEl(b)) return true;
        }
      }
    }
    return false;
  };

  const kind = action.kind || "model";
  const want = action.uiLabel || action.value;
  if (!want) return { ok: false, message: "No target model" };

  openPicker();
  await sleep(200);

  if (kind === "effort") {
    // Open Effort row then pick High
    const effortRow = findItem("Effort");
    if (effortRow) {
      clickEl(effortRow);
      await sleep(160);
    }
  }

  const item = findItem(want);
  if (!item) {
    return { ok: false, message: action.hint || `Pick ${want} in Claude’s menu` };
  }
  clickEl(item);
  await sleep(220);
  return { ok: true, method: "menu" };
};
