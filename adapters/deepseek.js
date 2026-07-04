/* DeepSeek (chat.deepseek.com) adapter — shared factory.
 * Verified live against a logged-in session. Every turn is a .ds-message; the
 * assistant answer renders into .ds-assistant-message-main-content (stable,
 * ds-namespaced), while user bubbles carry only deploy-hashed classes. So we
 * split roles structurally: assistant = .ds-message that :has() the assistant
 * content, user = .ds-message that does not. The composer is a placeholder-only
 * <textarea> (no #chat-input) and send is a ds-button--circle div[role=button].
 * The fail-soft guard in content.js covers any future drift. */
globalThis.LumenAdapterDeepSeek = globalThis.LumenCreateAdapter({
  hostnames: ["chat.deepseek.com"],
  platform: "deepseek",
  userSelector: ".ds-message:not(:has(.ds-assistant-message-main-content))",
  assistantSelector: ".ds-message:has(.ds-assistant-message-main-content)",
  userWrappers: [".ds-message"],
  inputs: ['textarea[placeholder*="Message" i]', "textarea", "#chat-input", '[contenteditable="true"]'],
  sendButtons: [
    'div[role="button"].ds-button--primary.ds-button--filled.ds-button--circle:not(.ds-button--disabled)',
    'div[role="button"].ds-button--primary.ds-button--filled:not(.ds-button--disabled)',
    'button[type="submit"]',
  ],
});
