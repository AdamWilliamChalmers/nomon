/* MiniMax — MiniMax Agent / Chat (agent.minimax.io, chat.minimax.io) — factory.
 * chat.minimax.io redirects to agent.minimax.io. The composer was verified live
 * as a tiptap/ProseMirror contenteditable with data-testid="message-textarea"
 * and a "Send message" button. Message-role selectors are behind login and thus
 * best-effort (data-testid + class fallbacks); fail-soft guard covers drift. */
globalThis.LumenAdapterMiniMax = globalThis.LumenCreateAdapter({
  hostnames: ["minimax.io", "minimaxi.com"],
  platform: "minimax",
  userSelector:
    '[data-message-author-role="user"], [data-testid*="user-message" i], [class*="user-message"], [class*="userMessage"]',
  assistantSelector:
    '[data-message-author-role="assistant"], [data-testid*="assistant-message" i], [data-testid*="ai-message" i], [class*="assistant-message"], [class*="assistantMessage"]',
  userWrappers: ['[data-message-author-role="user"]', "[class*='user-message']", "[class*='messageRow']"],
  inputs: [
    '[data-testid="message-textarea"]',
    "div.ProseMirror",
    '[contenteditable="true"]',
    "textarea",
  ],
  sendButtons: [
    'button[aria-label="Send message"]',
    'button[aria-label*="send" i]',
    'button[data-testid*="send" i]',
    'button[type="submit"]',
  ],
});
