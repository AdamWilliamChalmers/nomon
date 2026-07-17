import { estimateSavings } from "@/lib/cost";
import type { AnalyzeContext, RuleMatch, SavingsRule } from "@/lib/types";

/**
 * Flag over-allocated max_tokens vs assumed need.
 */
export const maxTokensRule: SavingsRule = {
  id: "max-tokens",
  title: "Right-size max_tokens",
  detect(ctx: AnalyzeContext): RuleMatch[] {
    const { maxTokens, assumedOutputTokens, model, monthlyVolume } = ctx;
    if (maxTokens == null || maxTokens <= 0) return [];

    // Only flag when budget is clearly larger than intended output
    if (maxTokens <= assumedOutputTokens * 1.5) return [];
    if (maxTokens - assumedOutputTokens < 256) return [];

    const waste = maxTokens - assumedOutputTokens;
    // Providers bill actual output, not the cap — so this is risk/waste guidance,
    // scored on the overage relative to typical generation length.
    // We estimate savings only for the portion users report they don't need.
    const estimable = Math.min(waste, assumedOutputTokens);
    if (estimable < 128) return [];

    return [
      {
        ruleId: "max-tokens",
        title: `Lower max_tokens from ${maxTokens} → ~${assumedOutputTokens}`,
        severity: waste > 2000 ? "high" : "medium",
        summary: `Your output budget is ${maxTokens} tokens but you expect ~${assumedOutputTokens}. Caps don't bill unused tokens, but loose caps invite long, expensive answers.`,
        suggestion: `Set max_tokens near your real need (e.g. ${assumedOutputTokens}) and ask for concise output in the prompt. Revisit if truncations appear.`,
        estimate: estimateSavings(
          estimable,
          model,
          monthlyVolume,
          "output"
        ),
      },
    ];
  },
};
