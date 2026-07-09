/* Perplexity (perplexity.ai) adapter — shared factory.
 * Best-effort selectors; the Depth signal is especially relevant here for
 * research-mode users. Fail-soft guard in content.js covers selector drift. */
globalThis.LumenAdapterPerplexity = globalThis.LumenCreateAdapter({
  hostnames: ["perplexity.ai"],
  platform: "perplexity",
  userSelector:
    '[data-testid="user-query"], [class*="queryText"], .my-md.whitespace-pre-line',
  assistantSelector:
    '[data-testid="answer"], [class*="answerText"], .prose[class*="answer"], [id^="markdown-content"]',
  assistantWrappers: ['[data-testid="answer"]', '[class*="answerText"]', '[id^="markdown-content"]'],
  userWrappers: ['[data-testid="user-query"]', '[class*="queryText"]'],
  inputs: ['textarea', '[contenteditable="true"]'],
});
