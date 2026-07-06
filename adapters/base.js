/**
 * Shared adapter factory for LLM sites that have no role attribute on messages
 * (Claude, Gemini, Grok). Produces an object implementing the same interface as
 * adapters/chatgpt.js so the shared engine/widget need no changes. Messages are
 * gathered from user/assistant selectors and ordered by document position.
 *
 * config = {
 *   hostnames: string[],            // substrings matched against location.hostname
 *   platform: string,
 *   userSelector: string,
 *   assistantSelector: string,
 *   container?: string,             // default "main"
 *   userWrappers?: string[],        // closest() selectors for the user bubble
 *   inputs?: string[],              // composer selectors, tried in order
 *   sendButtons?: string[],           // send button selectors, tried in order
 *   matchesFn?: () => boolean,      // override host matching (e.g. path-scoped)
 * }
 */
function outermostElements(nodeList) {
  const list = Array.from(nodeList);
  return list.filter(
    (el) => !list.some((other) => other !== el && other.contains(el))
  );
}

globalThis.LumenCreateAdapter = function LumenCreateAdapter(config) {
  const containerSelector = config.container || "main";

  return {
    hostnames: config.hostnames,
    platform: config.platform,
    USER_SELECTOR: config.userSelector,
    ASSISTANT_SELECTOR: config.assistantSelector,

    matches() {
      if (config.matchesFn) return config.matchesFn();
      return this.hostnames.some((h) => window.location.hostname.includes(h));
    },

    getMessageContainer() {
      return document.querySelector(containerSelector) || document.body;
    },

    getUserMessages() {
      return document.querySelectorAll(this.USER_SELECTOR);
    },

    getAssistantMessages() {
      return document.querySelectorAll(this.ASSISTANT_SELECTOR);
    },

    getMessageText(el) {
      if (!el) return "";
      return (el.innerText || el.textContent || "").trim();
    },

    getMessageId(el, role, index) {
      const host = window.location.hostname;
      const explicit =
        el.getAttribute?.("data-message-id") ||
        el.closest?.("[data-message-id]")?.getAttribute("data-message-id");
      if (explicit) return `${host}:${explicit}`;
      return `lumen-${host}-${role}-${index}`;
    },

    buildMessageList() {
      let userEls = [];
      let assistantEls = [];
      try {
        // Comma-separated selectors often match nested nodes in the same turn
        // (e.g. Gemini's user-query wrapping .query-content) — keep outermost only.
        userEls = outermostElements(document.querySelectorAll(this.USER_SELECTOR));
        assistantEls = outermostElements(document.querySelectorAll(this.ASSISTANT_SELECTOR));
      } catch (_) {
        return [];
      }

      const tagged = [
        ...userEls.map((el) => ({ el, role: "user" })),
        ...assistantEls.map((el) => ({ el, role: "assistant" })),
      ];

      tagged.sort((a, b) => {
        if (a.el === b.el) return 0;
        const pos = a.el.compareDocumentPosition(b.el);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });

      return tagged
        .map((t, index) => ({
          id: this.getMessageId(t.el, t.role, index),
          role: t.role,
          text: this.getMessageText(t.el),
          el: t.el,
          order: index,
        }))
        .filter((msg) => msg.text);
    },

    findUserMessageWrapper(el) {
      for (const sel of config.userWrappers || []) {
        const wrapper = el.closest?.(sel);
        if (wrapper) return wrapper;
      }
      return el;
    },

    findChatInput() {
      for (const sel of config.inputs || ['[contenteditable="true"]', "textarea"]) {
        const el = document.querySelector(sel);
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
        const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
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
      const selectors = config.sendButtons || [
        'button[data-testid="send-button"]',
        'button[aria-label*="Send" i]',
        'button[aria-label*="send" i]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
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
      try {
        if (el.matches?.(this.ASSISTANT_SELECTOR)) return true;
        return Boolean(el.querySelector?.(this.ASSISTANT_SELECTOR));
      } catch (_) {
        return false;
      }
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
          (m.el === wrapper || m.el.contains(wrapper) || wrapper.contains(m.el))
      );

      if (userIndex !== -1) {
        for (let i = userIndex + 1; i < messages.length; i += 1) {
          const msg = messages[i];
          if (msg.role === "user") break;
          hideEl(msg.el);
        }
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
};
