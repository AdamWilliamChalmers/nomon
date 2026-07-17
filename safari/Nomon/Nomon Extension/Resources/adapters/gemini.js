/* Gemini (gemini.google.com) adapter — built on the shared factory.
 * Match outer turn wrappers only: .query-content and [data-message-author]
 * live inside user-query / model-response; matching both double-counts a turn
 * and injects duplicate strips. base.js also dedupes nested selector hits.
 * Selectors are best-effort against Gemini's Angular DOM; if they drift, the
 * fail-soft guard in content.js keeps Lumen from breaking the page. */
globalThis.LumenAdapterGemini = globalThis.LumenCreateAdapter({
  hostnames: ["gemini.google.com"],
  platform: "gemini",
  userSelector: "user-query",
  assistantSelector: "model-response",
  assistantWrappers: ["model-response", ".query-content", "[data-message-author]"],
  userWrappers: ["user-query", ".query-content", "[data-message-author]"],
  inputs: ['.ql-editor[contenteditable="true"]', '[contenteditable="true"]', "textarea"],
});

/**
 * Read Gemini's model picker near the composer.
 * UI (Jul 2026): 3.1 Flash-Lite · 3.5 Flash · 3.1 Pro · "Extended thinking".
 * Composer pill may show "Flash Extended" when Flash + Extended is on.
 */
globalThis.LumenAdapterGemini.getSelectedModel = function getSelectedModel() {
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const MODEL_RE =
    /\b((?:\d+(?:\.\d+)?\s+)?(?:flash-?\s*lite|flash|pro)|gemini\s+\d+(?:\.\d+)?\s+(?:flash-?\s*lite|flash|pro)|flash\s*extended)\b/i;

  const texts = [];
  const pushText = (raw, source) => {
    const t = clean(raw);
    if (!t || t.length > 100) return;
    texts.push({ t, source });
  };

  document
    .querySelectorAll(
      'button[aria-haspopup="menu"], button[aria-haspopup="listbox"], [role="button"]'
    )
    .forEach((el) => {
      const t = clean(el.getAttribute("aria-label") || el.textContent);
      if (MODEL_RE.test(t) || /flash\s*extended|extended\s*thinking/i.test(t)) {
        pushText(t, "switcher");
      }
    });

  document
    .querySelectorAll(
      '[role="menuitemradio"], [role="menuitem"], [role="option"], [role="menuitemcheckbox"]'
    )
    .forEach((el) => {
      const checked =
        el.getAttribute("aria-checked") === "true" ||
        el.getAttribute("aria-selected") === "true";
      const t = clean(el.getAttribute("aria-label") || el.textContent);
      if (checked || MODEL_RE.test(t) || /extended\s*thinking/i.test(t)) {
        pushText(t, checked ? "menu-checked" : "menu-item");
      }
    });

  const input = this.findChatInput?.();
  const composer =
    input?.closest("form") ||
    input?.closest("[class*='composer']") ||
    input?.closest("[class*='input']") ||
    input?.parentElement?.parentElement;
  if (composer) {
    composer.querySelectorAll("button").forEach((btn) => {
      const t = clean(btn.textContent);
      if (MODEL_RE.test(t) || /flash\s*extended|extended/i.test(t)) {
        pushText(t, "composer-btn");
      }
    });
  }

  let modelLabel = null;
  let label = null;
  let extended = false;

  for (const { t } of texts) {
    if (/extended\s*thinking/i.test(t) && !/flash/i.test(t)) {
      extended = true;
      continue;
    }
    if (/flash\s*extended/i.test(t)) {
      modelLabel = "3.5 Flash";
      label = t;
      extended = true;
      break;
    }
  }

  if (!modelLabel) {
    for (const { t } of texts) {
      const m = t.match(
        /\b((?:\d+(?:\.\d+)?)\s+(?:flash-?\s*lite|flash|pro)|gemini\s+\d+(?:\.\d+)?\s+(?:flash-?\s*lite|flash|pro))\b/i
      );
      if (m) {
        modelLabel = m[1].replace(/\s+/g, " ");
        label = label || t;
        break;
      }
    }
  }

  if (!label && modelLabel) {
    label = extended ? `${modelLabel} Extended` : modelLabel;
  }

  if (!label && !modelLabel && !extended) {
    return {
      id: null,
      label: null,
      modelLabel: null,
      extended: false,
      confidence: "unknown",
      host: "gemini",
    };
  }

  return {
    id: null,
    label,
    modelLabel,
    extended,
    confidence: modelLabel ? "exact" : "mapped",
    host: "gemini",
  };
};

/**
 * Best-effort: open Gemini’s model menu and pick the tip target.
 * @param {{ kind?: string, value?: string, uiLabel?: string }} action
 */
globalThis.LumenAdapterGemini.switchModel = async function switchModel(action = {}) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const clickEl = (el) => {
    if (!el) return false;
    el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
    el.click();
    return true;
  };

  const findItem = (want) => {
    const target = clean(want).toLowerCase().replace(/-/g, " ");
    const nodes = document.querySelectorAll(
      '[role="menuitemradio"], [role="menuitem"], [role="option"], [role="menuitemcheckbox"], button'
    );
    for (const el of nodes) {
      const t = clean(el.getAttribute("aria-label") || el.textContent)
        .toLowerCase()
        .replace(/-/g, " ");
      if (!t || t.length > 100) continue;
      if (t === target || t.includes(target)) return el;
    }
    return null;
  };

  const openPicker = () => {
    const input = this.findChatInput?.();
    const composer =
      input?.closest("form") ||
      input?.closest("[class*='composer']") ||
      input?.closest("[class*='input']") ||
      input?.parentElement?.parentElement;
    const MODEL_RE = /flash|pro|extended/i;
    const buttons = [];
    document
      .querySelectorAll('button[aria-haspopup="menu"], button[aria-haspopup="listbox"]')
      .forEach((b) => buttons.push(b));
    if (composer) {
      composer.querySelectorAll("button").forEach((b) => {
        if (MODEL_RE.test(clean(b.textContent))) buttons.push(b);
      });
    }
    for (const b of buttons) {
      if (MODEL_RE.test(clean(b.textContent))) {
        if (clickEl(b)) return true;
      }
    }
    return false;
  };

  const want = action.uiLabel || action.value;
  if (!want) return { ok: false, message: "No target model" };

  openPicker();
  await sleep(200);

  const item = findItem(want);
  if (!item) {
    return { ok: false, message: action.hint || `Pick ${want} in Gemini’s menu` };
  }
  clickEl(item);
  await sleep(220);
  return { ok: true, method: "menu" };
};
