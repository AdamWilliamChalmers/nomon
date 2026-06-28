/* Grok adapter — grok.com and the path-scoped x.com/i/grok surface.
 * Selectors are best-effort; the fail-soft guard in content.js prevents a
 * selector drift from breaking the page. matchesFn keeps Lumen off the rest of
 * x.com (only the /i/grok path). */
globalThis.LumenAdapterGrok = globalThis.LumenCreateAdapter({
  hostnames: ["grok.com", "x.com"],
  platform: "grok",
  matchesFn() {
    const host = window.location.hostname;
    if (host.includes("grok.com")) return true;
    if (host.includes("x.com")) return (window.location.pathname || "").startsWith("/i/grok");
    return false;
  },
  userSelector:
    '[data-testid="user-message"], .user-message-bubble, [class*="userMessage"]',
  assistantSelector:
    '[data-testid="assistant-message"], .response-content-markdown, [class*="botMessage"], [class*="assistantMessage"]',
  userWrappers: ['[data-testid="user-message"]', ".user-message-bubble", "[class*='messageRow']"],
  inputs: ['textarea', '[contenteditable="true"]'],
});
