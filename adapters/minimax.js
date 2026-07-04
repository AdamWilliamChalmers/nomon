/* MiniMax — MiniMax Chat (chat.minimax.io / chat.minimaxi.com) — shared factory.
 * Best-effort selectors against MiniMax's DOM; the fail-soft guard in content.js
 * prevents a selector drift from breaking the page. */
globalThis.LumenAdapterMiniMax = globalThis.LumenCreateAdapter({
  hostnames: ["minimax.io", "minimaxi.com"],
  platform: "minimax",
  userSelector:
    '[data-message-author-role="user"], [class*="user-message"], [class*="userMessage"], [class*="human"]',
  assistantSelector:
    '[data-message-author-role="assistant"], [class*="assistant-message"], [class*="assistantMessage"], [class*="markdown"]',
  userWrappers: ['[data-message-author-role="user"]', "[class*='user-message']", "[class*='messageRow']"],
  inputs: ['textarea', '[contenteditable="true"]'],
});
