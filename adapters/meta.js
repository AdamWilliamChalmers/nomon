/* Meta AI (meta.ai) adapter — shared factory.
 * Verified live against a logged-in session: each turn is wrapped in
 * [data-message-item="true"] carrying a data-message-id that ends in "_user" or
 * "_assistant" — the most stable role hook (Meta's visible classes are
 * obfuscated atomic CSS). We match on data-message-id only: the inner
 * data-message-type="user" node is nested inside it, so matching both would
 * double-count a turn. The id also gives the engine a stable per-message key.
 * The composer is a plain <input> on the home screen and a
 * [data-testid="composer-input"] textarea inside a conversation, so both are
 * covered. The fail-soft guard in content.js handles any future drift. */
globalThis.LumenAdapterMeta = globalThis.LumenCreateAdapter({
  hostnames: ["meta.ai"],
  platform: "meta",
  userSelector: '[data-message-id$="_user"]',
  assistantSelector: '[data-message-id$="_assistant"]',
  userWrappers: ['[data-message-id$="_user"]', '[data-message-item="true"]'],
  inputs: [
    '[data-testid="composer-input"]',
    'input[placeholder*="Ask Meta" i]',
    "textarea",
    'input[type="text"]',
  ],
  sendButtons: [
    'button[aria-label="Send"]',
    'button[aria-label*="send" i]',
    'button[type="submit"]',
  ],
});
