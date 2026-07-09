/* Mistral — Le Chat (chat.mistral.ai) adapter — shared factory.
 * Messages are tagged with data-message-author-role (same pattern as ChatGPT),
 * and the composer is a ProseMirror contenteditable (not a textarea), so a
 * textarea-only selector would never match. Selectors cross-checked against
 * public references verified live in 2026; fail-soft guard covers drift. */
globalThis.LumenAdapterMistral = globalThis.LumenCreateAdapter({
  hostnames: ["chat.mistral.ai"],
  platform: "mistral",
  userSelector:
    '[data-message-author-role="user"], [data-role="user"], .user-message',
  assistantSelector:
    '[data-message-author-role="assistant"], [data-role="assistant"], .assistant-message',
  assistantWrappers: [
    '[data-message-author-role="assistant"]',
    '[data-role="assistant"]',
    ".assistant-message",
  ],
  userWrappers: ['[data-message-author-role="user"]', '[data-role="user"]', ".user-message"],
  inputs: ["div.ProseMirror", '[contenteditable="true"]', "textarea"],
  sendButtons: [
    'button[aria-label="Send"]',
    'button[aria-label*="send" i]',
    'button[type="submit"]',
  ],
});
