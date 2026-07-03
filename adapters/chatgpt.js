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
    const explicit =
      el.getAttribute("data-message-id") ||
      el.closest("[data-message-id]")?.getAttribute("data-message-id");
    if (explicit) return explicit;
    return `lumen-${role}-${index}`;
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
};

globalThis.LumenAdapterChatGPT = LumenAdapterChatGPT;
