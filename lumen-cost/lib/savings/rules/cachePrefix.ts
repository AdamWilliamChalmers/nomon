import { estimateSavings } from "@/lib/cost";
import type { AnalyzeContext, RuleMatch, SavingsRule } from "@/lib/types";

const SYSTEMISH =
  /^(system|instructions?|role|persona|you are|always|never|guidelines?|policy)\b/im;
const MARKER_BLOCKS =
  /<(system|instructions?|context|rules?)[^>]*>[\s\S]*?<\/\1>/gi;
const TRIPLE_DASH = /^(-{3,}|#{1,3}\s+(system|instructions?))\s*$/im;

/**
 * Long static prefixes that are reused across calls are the biggest
 * real-world caching win. We flag prompts with a system-like head block.
 */
export const cachePrefixRule: SavingsRule = {
  id: "cache-prefix",
  title: "Prompt caching candidate",
  detect(ctx: AnalyzeContext): RuleMatch[] {
    const { prompt, model, inputTokens, monthlyVolume } = ctx;
    if (!prompt.trim() || inputTokens < 120) return [];

    let cacheableChars = 0;
    let excerpt = "";

    const marked = [...prompt.matchAll(MARKER_BLOCKS)];
    if (marked.length > 0) {
      cacheableChars = marked.reduce((n, m) => n + m[0].length, 0);
      excerpt = marked[0][0].slice(0, 220);
    } else {
      // Take the first ~40% or first 2k chars as "prefix" if it looks systemish
      const cut = Math.min(
        Math.floor(prompt.length * 0.4),
        2400,
        prompt.length
      );
      const head = prompt.slice(0, cut);
      const looksSystem =
        SYSTEMISH.test(head) ||
        TRIPLE_DASH.test(head) ||
        head.split("\n").filter((l) => l.trim().length > 40).length >= 6;

      if (looksSystem && head.trim().length >= 400) {
        cacheableChars = head.length;
        excerpt = head.slice(0, 220);
      }
    }

    // Tagged system blocks can be shorter; bare prefixes need more substance
    const minChars = marked.length > 0 ? 280 : 400;
    if (cacheableChars < minChars) return [];

    const cacheableTokens = Math.round(
      inputTokens * (cacheableChars / Math.max(prompt.length, 1))
    );
    if (cacheableTokens < 80) return [];

    // Cache hit saves the delta between full input and cached input rate
    if (!model.supportsCaching || model.cachedInputPerMillion == null) {
      return [
        {
          ruleId: "cache-prefix",
          title: "Stable prefix — consider caching (model lacks it)",
          severity: "medium",
          summary: `~${cacheableTokens} tokens look static. This model doesn't advertise prompt caching — isolate them as a system prompt and prefer a cache-capable model.`,
          suggestion:
            "Extract the static instructions into a system/context block and call a model with prompt caching (Claude, GPT-4.1, Gemini).",
          excerpt,
          estimate: estimateSavings(
            Math.round(cacheableTokens * 0.5),
            model,
            monthlyVolume,
            "input"
          ),
        },
      ];
    }

    const full = (cacheableTokens / 1_000_000) * model.inputPerMillion;
    const cached =
      (cacheableTokens / 1_000_000) * model.cachedInputPerMillion;
    const usdPerCall = Math.max(0, full - cached);

    return [
      {
        ruleId: "cache-prefix",
        title: "Enable prompt caching on your static prefix",
        severity: "high",
        summary: `~${cacheableTokens} input tokens look reusable across calls. Cached input on ${model.name} is ~${Math.round(
          (1 - model.cachedInputPerMillion / model.inputPerMillion) * 100
        )}% cheaper.`,
        suggestion:
          "Keep the static system/instructions block identical across requests and enable provider prompt caching. Put volatile user content after the cached prefix.",
        excerpt,
        estimate: {
          tokens: cacheableTokens,
          usdPerCall,
          usdPerMonth: usdPerCall * monthlyVolume,
        },
      },
    ];
  },
};
