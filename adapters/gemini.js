/* Gemini (gemini.google.com) adapter — built on the shared factory.
 * Selectors are best-effort against Gemini's Angular DOM; if they drift, the
 * fail-soft guard in content.js keeps Lumen from breaking the page. */
globalThis.LumenAdapterGemini = globalThis.LumenCreateAdapter({
  hostnames: ["gemini.google.com"],
  platform: "gemini",
  userSelector: 'user-query, .query-content, [data-message-author="user"]',
  assistantSelector:
    'model-response, .model-response-text, [data-message-author="model"]',
  userWrappers: ["user-query", ".query-content", "[data-message-author]"],
  inputs: ['.ql-editor[contenteditable="true"]', '[contenteditable="true"]', "textarea"],
});
