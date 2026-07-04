/* Meta AI (meta.ai) adapter — shared factory.
 * Best-effort selectors against Meta AI's DOM; the fail-soft guard in
 * content.js prevents a selector drift from breaking the page. */
globalThis.LumenAdapterMeta = globalThis.LumenCreateAdapter({
  hostnames: ["meta.ai"],
  platform: "meta",
  userSelector:
    '[data-message-author-role="user"], [data-role="user"], [class*="userMessage"], [aria-label*="You said" i]',
  assistantSelector:
    '[data-message-author-role="assistant"], [data-role="assistant"], [class*="assistantMessage"], [aria-label*="Meta AI said" i]',
  userWrappers: ['[data-message-author-role="user"]', '[data-role="user"]', "[class*='messageRow']"],
  inputs: ['[contenteditable="true"]', "textarea"],
});
