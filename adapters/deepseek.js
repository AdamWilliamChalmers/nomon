/* DeepSeek (chat.deepseek.com) adapter — shared factory.
 * Best-effort selectors against DeepSeek's DOM (assistant turns render into
 * .ds-markdown); the fail-soft guard in content.js prevents a selector drift
 * from breaking the page. */
globalThis.LumenAdapterDeepSeek = globalThis.LumenCreateAdapter({
  hostnames: ["chat.deepseek.com"],
  platform: "deepseek",
  userSelector:
    '[data-message-author-role="user"], [class*="_user"], [class*="userMessage"], [class*="fbb"]',
  assistantSelector:
    '.ds-markdown, [class*="ds-markdown"], [data-message-author-role="assistant"], [class*="assistantMessage"]',
  userWrappers: ['[data-message-author-role="user"]', "[class*='messageRow']", "[class*='_user']"],
  inputs: ['#chat-input', 'textarea', '[contenteditable="true"]'],
});
