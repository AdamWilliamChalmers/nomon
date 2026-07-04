/* Kimi (Moonshot AI) adapter — kimi.com and kimi.moonshot.cn — shared factory.
 * Verified live against a logged-in kimi.com session. Each turn is a
 * .chat-content-item(-user/-assistant) → .segment(-user/-assistant); user text
 * lives in .user-content and assistant text in .markdown (inside
 * .segment-assistant). The two content selectors are siblings across turns, so
 * they don't double-count. Composer is a controlled contenteditable and send is
 * .send-button-container. Fail-soft guard in content.js covers drift.
 * NOTE: kimi.moonshot.cn (legacy CN domain) may differ; verified on kimi.com. */
globalThis.LumenAdapterKimi = globalThis.LumenCreateAdapter({
  hostnames: ["kimi.com", "kimi.moonshot.cn"],
  platform: "kimi",
  userSelector: ".user-content",
  assistantSelector: ".segment-assistant .markdown, div.markdown",
  userWrappers: [".chat-content-item-user", ".segment-user", ".user-content"],
  inputs: ['[contenteditable="true"]', "textarea"],
  sendButtons: [
    ".send-button-container",
    'button[aria-label*="send" i]',
    'button[type="submit"]',
  ],
});
