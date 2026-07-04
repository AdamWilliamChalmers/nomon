/* Kimi (Moonshot AI) adapter — kimi.com and kimi.moonshot.cn — shared factory.
 * Best-effort selectors against Kimi's DOM; the fail-soft guard in content.js
 * prevents a selector drift from breaking the page. */
globalThis.LumenAdapterKimi = globalThis.LumenCreateAdapter({
  hostnames: ["kimi.com", "kimi.moonshot.cn"],
  platform: "kimi",
  userSelector:
    '[class*="user-content"], [class*="userMessage"], [data-message-author-role="user"], .user',
  assistantSelector:
    '[class*="assistant-content"], [class*="segment-assistant"], [data-message-author-role="assistant"], [class*="markdown"]',
  userWrappers: ['[class*="user-content"]', '[data-message-author-role="user"]', "[class*='chat-item']"],
  inputs: ['[contenteditable="true"]', "textarea"],
});
