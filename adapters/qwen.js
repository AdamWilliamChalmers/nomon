/* Qwen — Qwen Chat (chat.qwen.ai) adapter — shared factory.
 * Best-effort selectors against Qwen's DOM; the fail-soft guard in content.js
 * prevents a selector drift from breaking the page. */
globalThis.LumenAdapterQwen = globalThis.LumenCreateAdapter({
  hostnames: ["chat.qwen.ai", "qwen.ai"],
  platform: "qwen",
  userSelector:
    '[data-message-author-role="user"], [class*="user-message"], [class*="userMessage"], [id^="user-message"]',
  assistantSelector:
    '[data-message-author-role="assistant"], [class*="assistant-message"], [class*="assistantMessage"], [class*="markdown"]',
  userWrappers: ['[data-message-author-role="user"]', "[class*='user-message']", "[class*='messageRow']"],
  inputs: ['textarea', '[contenteditable="true"]'],
});
