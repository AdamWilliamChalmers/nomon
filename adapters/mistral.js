/* Mistral — Le Chat (chat.mistral.ai) adapter — shared factory.
 * Best-effort selectors against Le Chat's DOM; the fail-soft guard in
 * content.js prevents a selector drift from breaking the page. */
globalThis.LumenAdapterMistral = globalThis.LumenCreateAdapter({
  hostnames: ["chat.mistral.ai"],
  platform: "mistral",
  userSelector:
    '[data-message-author-role="user"], [data-message-role="user"], [class*="userMessage"], [class*="human-message"]',
  assistantSelector:
    '[data-message-author-role="assistant"], [data-message-role="assistant"], [class*="assistantMessage"], [class*="ai-message"]',
  userWrappers: ['[data-message-author-role="user"]', '[data-message-role="user"]', "[class*='messageRow']"],
  inputs: ['textarea', '[contenteditable="true"]'],
});
