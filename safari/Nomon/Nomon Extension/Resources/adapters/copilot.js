/* Microsoft Copilot adapter — shared factory.
 * Consumer: copilot.microsoft.com. Work/M365: m365.cloud.microsoft/chat (and
 * copilot.cloud.microsoft/chat redirects). Best-effort selectors; fail-soft in
 * content.js. Copilot embedded inside Word/Outlook is a different surface. */
globalThis.LumenAdapterCopilot = globalThis.LumenCreateAdapter({
  hostnames: ["copilot.microsoft.com", "m365.cloud.microsoft", "copilot.cloud.microsoft"],
  platform: "copilot",
  matchesFn() {
    const { hostname, pathname } = window.location;
    if (hostname.includes("copilot.microsoft.com")) return true;
    if (hostname.includes("m365.cloud.microsoft") || hostname.includes("copilot.cloud.microsoft")) {
      return pathname.startsWith("/chat");
    }
    return false;
  },
  userSelector:
    '[data-content="user-message"], [class*="userMessage"], [data-author="user"]',
  assistantSelector:
    '[data-content="ai-message"], [class*="aiMessage"], [class*="botMessage"], [data-author="bot"]',
  assistantWrappers: [
    '[data-content="ai-message"]',
    '[class*="aiMessage"]',
    '[class*="botMessage"]',
    "[data-author]",
  ],
  userWrappers: ['[data-content="user-message"]', '[class*="userMessage"]', "[data-author]"],
  inputs: ['[data-testid="composer-input"]', "textarea", '[contenteditable="true"]'],
  sendButtons: [
    'button[aria-label*="Submit message" i]',
    'button[aria-label*="Send" i]',
    'button[aria-label*="send" i]',
  ],
});
