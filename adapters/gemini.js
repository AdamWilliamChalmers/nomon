/* Gemini (gemini.google.com) adapter — built on the shared factory.
 * Match outer turn wrappers only: .query-content and [data-message-author]
 * live inside user-query / model-response; matching both double-counts a turn
 * and injects duplicate strips. base.js also dedupes nested selector hits.
 * Selectors are best-effort against Gemini's Angular DOM; if they drift, the
 * fail-soft guard in content.js keeps Lumen from breaking the page. */
globalThis.LumenAdapterGemini = globalThis.LumenCreateAdapter({
  hostnames: ["gemini.google.com"],
  platform: "gemini",
  userSelector: "user-query",
  assistantSelector: "model-response",
  userWrappers: ["user-query", ".query-content", "[data-message-author]"],
  inputs: ['.ql-editor[contenteditable="true"]', '[contenteditable="true"]', "textarea"],
});
