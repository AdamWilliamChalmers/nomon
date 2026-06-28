/* Microsoft Copilot (copilot.microsoft.com) adapter — shared factory.
 * Best-effort selectors against Copilot's web DOM; the fail-soft guard in
 * content.js prevents a selector drift from breaking the page. The Office-suite
 * embedding uses a different injection model and is out of scope here. */
globalThis.LumenAdapterCopilot = globalThis.LumenCreateAdapter({
  hostnames: ["copilot.microsoft.com"],
  platform: "copilot",
  userSelector:
    '[data-content="user-message"], [class*="userMessage"], [data-author="user"]',
  assistantSelector:
    '[data-content="ai-message"], [class*="aiMessage"], [class*="botMessage"], [data-author="bot"]',
  userWrappers: ['[data-content="user-message"]', '[class*="userMessage"]', "[data-author]"],
  inputs: ["textarea", '[contenteditable="true"]'],
});
