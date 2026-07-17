import type { AnalyzeContext, RuleMatch, SavingsRule } from "@/lib/types";
import { cachePrefixRule } from "./rules/cachePrefix";
import { fewShotBloatRule } from "./rules/fewShotBloat";
import { verboseJsonRule } from "./rules/verboseJson";
import { maxTokensRule } from "./rules/maxTokens";
import { modelDowngradeRule } from "./rules/modelDowngrade";

export const SAVINGS_RULES: SavingsRule[] = [
  cachePrefixRule,
  fewShotBloatRule,
  verboseJsonRule,
  maxTokensRule,
  modelDowngradeRule,
];

export interface AnalysisResult {
  matches: RuleMatch[];
  totalUsdPerCall: number;
  totalUsdPerMonth: number;
  totalTokens: number;
}

export function analyzePrompt(ctx: AnalyzeContext): AnalysisResult {
  const matches: RuleMatch[] = [];

  for (const rule of SAVINGS_RULES) {
    try {
      matches.push(...rule.detect(ctx));
    } catch {
      // A single rule must never break the panel
    }
  }

  matches.sort((a, b) => b.estimate.usdPerMonth - a.estimate.usdPerMonth);

  // Token totals exclude model-downgrade (tokens: 0) doubles
  const totalTokens = matches.reduce(
    (n, m) => n + (m.ruleId === "model-downgrade" ? 0 : m.estimate.tokens),
    0
  );
  const totalUsdPerCall = matches.reduce(
    (n, m) => n + m.estimate.usdPerCall,
    0
  );
  const totalUsdPerMonth = matches.reduce(
    (n, m) => n + m.estimate.usdPerMonth,
    0
  );

  return { matches, totalUsdPerCall, totalUsdPerMonth, totalTokens };
}

/** Best single rewritten prompt from rules that provide one. */
export function bestRewrite(matches: RuleMatch[]): string | null {
  const withRewrite = matches.find((m) => m.rewrittenPrompt);
  return withRewrite?.rewrittenPrompt ?? null;
}
