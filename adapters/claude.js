/* Claude.ai adapter — built on the shared factory (adapters/base.js). */
globalThis.LumenAdapterClaude = globalThis.LumenCreateAdapter({
  hostnames: ["claude.ai"],
  platform: "claude",
  userSelector: '[data-testid="user-message"], .font-user-message',
  assistantSelector: '.font-claude-message, [data-testid="assistant-message"]',
  userWrappers: [
    '[data-testid="user-message"]',
    ".font-user-message",
    "[data-test-render-count]",
  ],
  inputs: [
    'div.ProseMirror[contenteditable="true"]',
    '[contenteditable="true"]',
    "textarea",
  ],
});
