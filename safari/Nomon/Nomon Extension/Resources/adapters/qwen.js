/* Qwen — Qwen Chat / Qwen Studio (chat.qwen.ai) adapter — shared factory.
 * Selectors verified live (guest chat) against Qwen's DOM: each turn renders as
 * .qwen-chat-message with a role modifier class, the composer is a single
 * textarea.message-input-textarea, and send is .message-input-right-button-send.
 * The fail-soft guard in content.js covers any future selector drift. */
globalThis.LumenAdapterQwen = globalThis.LumenCreateAdapter({
  hostnames: ["chat.qwen.ai", "qwen.ai"],
  platform: "qwen",
  userSelector: ".qwen-chat-message-user, [class*='qwen-chat-message-user']",
  assistantSelector: ".qwen-chat-message-assistant, [class*='qwen-chat-message-assistant']",
  assistantWrappers: [".qwen-chat-message-assistant", ".qwen-chat-message"],
  userWrappers: [".qwen-chat-message-user", ".qwen-chat-message"],
  inputs: ["textarea.message-input-textarea", "textarea", '[contenteditable="true"]'],
  sendButtons: [
    ".message-input-right-button-send",
    'button[aria-label*="send" i]',
    'button[type="submit"]',
  ],
});
