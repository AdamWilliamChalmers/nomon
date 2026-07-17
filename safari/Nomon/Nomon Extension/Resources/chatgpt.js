globalThis.LumenAdapterChatGPT = null;

const LumenAdapterChatGPT = {
  hostname: "chat.openai.com",
  hostnames: ["chat.openai.com", "chatgpt.com"],

  matches() {
    return this.hostnames.includes(window.location.hostname);
  },

  getMessageContainer() {
    for (const selector of ["main", '[role="main"]', "#__next"]) {
      const node = document.querySelector(selector);
      if (node) return node;
    }
    return document.body;
  },

  getUserMessages() {
    return document.querySelectorAll(
      '[data-message-author-role="user"], [data-role="user"], .user-turn'
    );
  },

  getAssistantMessages() {
    return document.querySelectorAll(
      '[data-message-author-role="assistant"], [data-role="assistant"], .agent-turn'
    );
  },

  getMessageText(el) {
    const markdown = el.querySelector(
      ".markdown, .prose, .ds-markdown, [class*='markdown'], .whitespace-pre-wrap"
    );
    const source = markdown || el;
    return (source.innerText || source.textContent || "").trim();
  },

  inferRole(el) {
    return (
      el.getAttribute("data-message-author-role") ||
      el.getAttribute("data-role") ||
      (el.classList.contains("user-turn") ? "user" : null) ||
      (el.classList.contains("agent-turn") ? "assistant" : null) ||
      (el.closest(".user-turn") ? "user" : null) ||
      (el.closest(".agent-turn") ? "assistant" : null)
    );
  },

  getMessageId(el, role, index) {
    const host = window.location.hostname;
    const explicit =
      el.getAttribute("data-message-id") ||
      el.closest("[data-message-id]")?.getAttribute("data-message-id");
    if (explicit) return `${host}:${explicit}`;
    return `lumen-${host}-${role}-${index}`;
  },

  buildMessageList() {
    const roleNodes = document.querySelectorAll("[data-message-author-role]");
    if (roleNodes.length) {
      return Array.from(roleNodes)
        .map((el, index) => {
          const role = this.inferRole(el);
          const text = this.getMessageText(el);
          return { id: this.getMessageId(el, role, index), role, text, el, order: index };
        })
        .filter((msg) => (msg.role === "user" || msg.role === "assistant") && msg.text);
    }

    const turns = Array.from(document.querySelectorAll('[data-testid^="conversation-turn"]'));
    return turns
      .map((turn, index) => {
        const roleEl =
          turn.querySelector('[data-message-author-role], [data-role], .user-turn, .agent-turn') ||
          turn;
        const role = this.inferRole(roleEl);
        const text = this.getMessageText(turn);
        return { id: this.getMessageId(roleEl, role, index), role, text, el: turn, order: index };
      })
      .filter((msg) => (msg.role === "user" || msg.role === "assistant") && msg.text);
  },

  findUserMessageWrapper(el) {
    return (
      el.closest('[data-message-author-role="user"]') ||
      el.closest(".user-turn") ||
      el.closest("article") ||
      el
    );
  },

  findAssistantMessageWrapper(el) {
    return (
      el.closest('[data-message-author-role="assistant"]') ||
      el.closest(".agent-turn") ||
      el.closest("article") ||
      el
    );
  },

  findChatInput() {
    for (const selector of [
      "#prompt-textarea",
      "#chat-input",
      'div[contenteditable="true"]#prompt-textarea',
      'textarea[placeholder*="Ask"]',
      '[contenteditable="true"][data-placeholder]',
    ]) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  },

  dispatchComposerInput(el, text) {
    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: text,
      })
    );
  },

  setChatInputText(text) {
    const el = this.findChatInput();
    if (!el) return false;
    el.focus();

    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      if (setter) setter.call(el, text);
      else el.value = text;
    } else if (el.isContentEditable) {
      el.innerHTML = "";
      for (const line of text.split("\n")) {
        const p = document.createElement("p");
        if (line) p.textContent = line;
        else p.appendChild(document.createElement("br"));
        el.appendChild(p);
      }
    } else {
      el.textContent = text;
    }

    this.dispatchComposerInput(el, text);
    el.focus();
    return true;
  },

  getChatInputText() {
    const el = this.findChatInput();
    if (!el) return "";
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el.value || "";
    return (el.innerText || el.textContent || "").trim();
  },

  /**
   * Read ChatGPT's model / intelligence picker near the composer.
   * Returns enough for LumenCostModels.resolveChatGPTSelection().
   *
   * UI (Jul 2026): composer pill often shows "Medium" / "Instant" / "High";
   * menus list "GPT-5.6 Sol", "GPT-5.5", "GPT-5.4", "GPT-5.3", "o3", "Instant 5.5".
   */
  getSelectedModel() {
    const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

    const INTEL_RE = /^(instant(?:\s*5\.5)?|medium|high)$/i;
    const MODEL_RE =
      /\b(gpt[-\s]?5(?:\.\d+)?(?:\s*(?:sol|terra|luna|mini|nano|instant|pro))?|o3(?:-mini|-pro)?|gpt[-\s]?4o(?:\s*mini)?)\b/i;

    const texts = [];

    const pushText = (raw, source) => {
      const t = clean(raw);
      if (!t || t.length > 80) return;
      texts.push({ t, source });
    };

    // 1) Explicit model-switcher control (preferred)
    const switcherSelectors = [
      '[data-testid="model-switcher-dropdown-button"]',
      '[data-testid="model-switcher-button"]',
      'button[aria-label*="Model" i]',
      'button[aria-label*="GPT" i]',
      'button[data-testid*="model" i]',
    ];
    for (const sel of switcherSelectors) {
      document.querySelectorAll(sel).forEach((el) => {
        pushText(el.getAttribute("aria-label"), "switcher-aria");
        pushText(el.textContent, "switcher");
      });
    }

    // 2) Checked menu items (open or recently rendered menus)
    document
      .querySelectorAll(
        '[role="menuitemradio"][aria-checked="true"], [role="menuitem"][aria-checked="true"], [role="option"][aria-selected="true"]'
      )
      .forEach((el) => {
        pushText(el.getAttribute("aria-label") || el.textContent, "menu-checked");
      });

    // 3) Composer-adjacent buttons (ChatGPT nestles intelligence next to send)
    const input = this.findChatInput();
    const composer =
      input?.closest("form") ||
      input?.closest("[class*='composer']") ||
      input?.parentElement?.parentElement;
    if (composer) {
      composer.querySelectorAll("button").forEach((btn) => {
        const t = clean(btn.textContent);
        if (INTEL_RE.test(t) || MODEL_RE.test(t)) pushText(t, "composer-btn");
      });
    }

    let intelligence = null;
    let modelLabel = null;
    let label = null;

    for (const { t } of texts) {
      if (!intelligence && INTEL_RE.test(t)) intelligence = t;
      const modelMatch = t.match(MODEL_RE);
      if (!modelLabel && modelMatch) modelLabel = modelMatch[0];
      // Prefer a string that names a concrete model
      if (!label && MODEL_RE.test(t)) label = t;
    }
    if (!label && intelligence) label = intelligence;
    if (!label && modelLabel) label = modelLabel;

    if (!label && !intelligence && !modelLabel) {
      return {
        id: null,
        label: null,
        intelligence: null,
        modelLabel: null,
        confidence: "unknown",
        host: "chatgpt",
      };
    }

    // Prefer catalog resolve if available (content-script order loads models before adapters? 
    // Actually adapters load BEFORE cost/models.js — so resolve later in LumenCost).
    return {
      id: null,
      label,
      intelligence,
      modelLabel,
      confidence: modelLabel ? "exact" : "mapped",
      host: "chatgpt",
    };
  },

  findSendButton() {
    for (const selector of [
      'button[data-testid="send-button"]',
      'button[aria-label*="Send" i]',
      'button[aria-label*="send" i]',
    ]) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  },

  triggerSend() {
    const btn = this.findSendButton();
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    const input = this.findChatInput();
    if (input) {
      input.focus();
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        })
      );
      return true;
    }
    return false;
  },

  isAssistantNode(el) {
    if (!el) return false;
    const role = this.inferRole(el);
    if (role === "assistant") return true;
    if (el.querySelector?.('[data-message-author-role="assistant"], .agent-turn, [data-role="assistant"]')) {
      return true;
    }
    return false;
  },

  hideAssistantResponsesAfter(userEl) {
    const wrapper = this.findUserMessageWrapper(userEl);
    if (!wrapper) return () => {};

    const hidden = [];
    const hideEl = (el) => {
      if (!el || hidden.includes(el)) return;
      el.classList.add("lumen-ai-hidden");
      hidden.push(el);
    };

    const messages = this.buildMessageList();
    const userIndex = messages.findIndex(
      (m) =>
        m.role === "user" &&
        (m.el === wrapper ||
          m.el.contains(wrapper) ||
          wrapper.contains(m.el) ||
          wrapper.contains(m.el.closest("[data-message-author-role]")))
    );

    if (userIndex !== -1) {
      for (let i = userIndex + 1; i < messages.length; i += 1) {
        const msg = messages[i];
        if (msg.role === "user") break;
        hideEl(msg.el.closest("article"));
        hideEl(msg.el.closest('[data-testid="conversation-turn"]'));
        hideEl(msg.el.closest("[data-message-author-role]"));
        hideEl(msg.el.closest(".agent-turn"));
        hideEl(msg.el);
      }
    }

    const startNode =
      wrapper.closest("article") ||
      wrapper.closest('[data-testid="conversation-turn"]') ||
      wrapper.closest("[data-message-author-role]") ||
      wrapper;

    let node = startNode;
    while (node) {
      node = node.nextElementSibling;
      if (!node) break;
      if (
        node.querySelector?.(
          '[data-message-author-role="user"], [data-role="user"], .user-turn'
        )
      ) {
        break;
      }
      if (this.isAssistantNode(node) || node.querySelector?.('[data-message-author-role="assistant"]')) {
        hideEl(node);
        continue;
      }
      hideEl(node);
    }

    return () => {
      hidden.forEach((el) => el.classList.remove("lumen-ai-hidden"));
    };
  },

  onNewMessage(callback) {
    const container = this.getMessageContainer();
    const observer = new MutationObserver(() => callback());
    observer.observe(container, { childList: true, subtree: true });
    return observer;
  },

  /**
   * Best-effort: open ChatGPT’s intelligence/model menu and pick the tip target.
   * Instant ≈ GPT-5.6 Luna rates; Medium ≈ Terra; High ≈ Sol.
   * @param {{ kind?: string, value?: string, uiLabel?: string }} action
   * @returns {Promise<{ ok: boolean, method?: string, message?: string }>}
   */
  async switchModel(action = {}) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
    const clickEl = (el) => {
      if (!el) return false;
      el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      el.click();
      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      return true;
    };

    const findMenuItem = (want) => {
      const target = clean(want).toLowerCase();
      const nodes = document.querySelectorAll(
        '[role="menuitemradio"], [role="menuitem"], [role="option"]'
      );
      for (const el of nodes) {
        const t = clean(el.getAttribute("aria-label") || el.textContent).toLowerCase();
        if (!t) continue;
        if (t === target) return el;
        if (target === "instant" && /^instant(\s*5\.5)?$/.test(t)) return el;
        if (target === "medium" && t === "medium") return el;
        if (target === "high" && t === "high") return el;
        if (t.includes(target) && target.length >= 4) return el;
      }
      return null;
    };

    const openIntelligenceMenu = () => {
      const input = this.findChatInput?.();
      const composer =
        input?.closest("form") ||
        input?.closest("[class*='composer']") ||
        input?.parentElement?.parentElement;
      const INTEL_RE = /^(instant(?:\s*5\.5)?|medium|high)$/i;
      const candidates = [];
      const push = (el) => {
        if (el && !candidates.includes(el)) candidates.push(el);
      };
      for (const sel of [
        '[data-testid="model-switcher-dropdown-button"]',
        '[data-testid="model-switcher-button"]',
        'button[aria-label*="Model" i]',
        'button[data-testid*="model" i]',
      ]) {
        document.querySelectorAll(sel).forEach(push);
      }
      if (composer) {
        composer.querySelectorAll("button").forEach((btn) => {
          if (INTEL_RE.test(clean(btn.textContent))) push(btn);
        });
      }
      for (const el of candidates) {
        if (clickEl(el)) return true;
      }
      return false;
    };

    const kind = action.kind || "intelligence";
    const want =
      kind === "intelligence"
        ? action.value || action.uiLabel || "instant"
        : action.uiLabel || action.value;

    // Already on target?
    const before = this.getSelectedModel?.() || {};
    if (
      kind === "intelligence" &&
      clean(before.intelligence).toLowerCase().startsWith(clean(want).toLowerCase().slice(0, 7))
    ) {
      return { ok: true, method: "already" };
    }

    openIntelligenceMenu();
    await sleep(180);

    let item = findMenuItem(want);
    if (!item && kind === "model") {
      // Open nested "More models" if present
      const more = findMenuItem("More models") || findMenuItem("GPT-5.6 Sol");
      if (more) {
        clickEl(more);
        await sleep(180);
        item = findMenuItem(want);
      }
    }

    if (!item) {
      return {
        ok: false,
        message: action.hint || `Pick ${want} in the model menu`,
      };
    }

    clickEl(item);
    await sleep(220);

    const after = this.getSelectedModel?.() || {};
    if (kind === "intelligence") {
      const got = clean(after.intelligence || after.label).toLowerCase();
      const need = clean(want).toLowerCase();
      if (got.startsWith(need.slice(0, 7)) || got.includes(need)) {
        return { ok: true, method: "menu" };
      }
    } else {
      const got = clean(after.modelLabel || after.label).toLowerCase();
      if (got.includes(clean(want).toLowerCase().slice(0, 8))) {
        return { ok: true, method: "menu" };
      }
    }

    // Menu click often works even if we can't re-read the pill yet
    return { ok: true, method: "menu-unverified" };
  },
};

globalThis.LumenAdapterChatGPT = LumenAdapterChatGPT;
